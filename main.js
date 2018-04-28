const transferWatchers = new Set
class Token {
  constructor(string) {
    const [_, service, dialect] = string.match(/^(.+):(.+)$/)
    const token = this[service](dialect)
    localStorage[`token_${service}`] = token
  }
  ['put.io'](dialect) {
    const [_, $1, token] = dialect.match(/^(.+)=(.+)$/)
    return token
  }
}

(() => {

  const query = queryInHash()
  if (query.token) {
    new Token(query.token)
    delete query.token
    const querystring = Qs.stringify(query)
    location.hash = `#/?${querystring}`
  }

  const now = new Date
  const loading = window.results.innerHTML
  const advises = `超高清 超清 1280P BD 全高清 1080P FHD 高清 720P HD ${now.getFullYear()}`
  const format = [ 'mkv', 'avi', 'mp4', 'mpg', 'mpeg', 'rmvb', 'rm', 'webm' ]
  const filter = [
    { terms: { extnames: format } },
    { match: { name: advises } },
  ]

  nunjucks.configure({
    web: { async: true, useCache: true },
    autoescape: true
  })

  async function refetch() {
    transferWatchers.clear()

    window.results.innerHTML = loading
    let q = findQ()
    document.title = `${q} - Zhongzi.io`

    ga('set', 'page', `${location.pathname}${location.search}${location.hash}`);
    ga('send', 'pageview');

    {
      const search = {
        sort: [
          { _score: 'desc' },
          { discovered_at: 'desc' }
        ],
        query: {
          bool: {
            must:   [ { match:        { name: q } } ],
            should: [ { match_phrase: { name: q } } ],
            filter
          }
        }
      }
      const _q = b64EncodeUnicode(JSON.stringify(search))
      const response = await fetch(`https://api.zhongzi.io/search/?${Qs.stringify({q: _q})}`)
      const results = await response.json()

      nunjucks.render('template.html', results, (error, html) => {
        window.results.innerHTML = html
      })
    }
  }

  function b64EncodeUnicode(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
      return String.fromCharCode('0x' + p1);
    }));
  }

  refetch()
  window.addEventListener("hashchange", refetch)

})()

function queryInHash() {
  return Qs.parse(location.hash.slice(location.hash.indexOf('?') + 1))
}

function findQ() {
  let q
  q = queryInHash().q
  if (!q) {
    q = Qs.parse(location.search.slice(1)).q
  }
  if (q) {
    window.search.value = q
  } else {
    q = 'Movie, TV, Anime'
  }
  return q
}

const isiOSDevice = navigator.userAgent.match(/ipad|iphone/i);

function magnet(element, event) {

  event.preventDefault()

  const input = element.querySelector('input')

  if (isiOSDevice) {

    const editable = input.contentEditable;
    const readOnly = input.readOnly;

    input.contentEditable = true;
    input.readOnly = false;

    const range = document.createRange();
    range.selectNodeContents(input);

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    input.setSelectionRange(0, 1e6);
    input.contentEditable = editable;
    input.readOnly = readOnly;
    //notie.alert({text: 'Please copy to clipboard manually!'})

  } else {
    input.select();
  }
  document.execCommand('copy')
  notie.alert({text: 'Magnet has been copied to clipboard!'})

}

async function watch(element) {

  const API_PREFIX = 'https://api.put.io/v2'
  const token = localStorage['token_put.io']
  if (!token) {
    const redirect_uri_querystring = Qs.stringify({
      q: findQ(),
      token: 'put.io:'
    })
    const querystring = Qs.stringify({
      client_id: 2999,
      response_type: 'token',
      redirect_uri: `${location.origin}${location.pathname}#/?${redirect_uri_querystring}`
    })
    location.href = `https://api.put.io/v2/oauth2/authenticate?${querystring}`
    return
  }

  element.innerText = 'Transferring'
  element.disabled  = true
  const progress = element.parentNode.querySelector('[data-role="progress"]')
  progress.hidden = false
  const progressBar = progress.firstElementChild

  const API_SUFFIX = `&oauth_token=${token}`
  const {infohash, magnet, name} = element.parentNode.dataset

  const files = await fetch(
    `${API_PREFIX}/files/list?${API_SUFFIX}`
  )
  .then(response => response.json())
  .then(json => json.files)

  //let directory = list.files.find((file) => infohash === file.name)
  let root = files.find((file) => 'zhongzi.io' === file.name)
  if (!root) {
    root = await fetch(
      `${API_PREFIX}/files/create-folder?${API_SUFFIX}`,
      {
        method: 'POST',
        mode: 'cors',
        headers: {
          'content-type': 'application/json',
          'accept'      : 'application/json'
        },
        body: JSON.stringify({name: 'zhongzi.io'})
      }
    )
    .then(response => response.json())
    .then(json => json.file)
  }

  const downloadedFiles = await fetch(
    `${API_PREFIX}/files/list?parent_id=${root.id}${API_SUFFIX}`
  )
  .then(response => response.json())
  .then(json => json.files)

  const downloaded = downloadedFiles.find(file => name === file.name)

  if (downloaded) {
    return complete(downloaded.id)
  }

  let transfer
  const transfers = await fetch(
    `${API_PREFIX}/transfers/list?${API_SUFFIX}`,
  )
  .then(response => response.json())
  .then(json => json.transfers)
  transfer = transfers.find(transfer => magnet === transfer.source)

  if (!transfer) {
    transfer = await fetch(
      `${API_PREFIX}/transfers/add?${API_SUFFIX}`,
      {
        method: 'POST',
        mode: 'cors',
        headers: {
          'content-type': 'application/json',
          'accept'      : 'application/json'
        },
        body: JSON.stringify({url: magnet, save_parent_id: root.id})
      }
    )
    .then(response => response.json())
    .then(json => json.transfer)
  }

  transferWatchers.add(transfer.id)
  while (!transfer.finished_at && transferWatchers.has(transfer.id)) {
    transfer = await fetch(
      `${API_PREFIX}/transfers/${transfer.id}?${API_SUFFIX}`
    )
    .then(response => response.json())
    .then(json => json.transfer)
    progressBar.style.width = `${transfer.percent_done}%`
    element.innerText = `Transferring (${transfer.percent_done}%)...`
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  return complete(transfer.file_id)

  function complete(id) {
    element.hidden = true
    progress.hidden = true
    const watch = element.parentNode.querySelector('[data-role="watch"]')
    watch.href = `https://app.put.io/files/${id}`
    watch.hidden = false
  }

}

function submit(event) {
  event.preventDefault()
  document.activeElement.blur()
  location.hash = `#/?q=${encodeURIComponent(search.value)}`
}
