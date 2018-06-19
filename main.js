const API_ROOT = localStorage.API_ROOT || 'https://api.zhongzi.io'

;(() => {

  const query = queryInHash()

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

    window.results.innerHTML = loading
    let q = recognizeQ()
    document.title = `${q.title} - Zhongzi.io`

    ga('set', 'page', `${location.pathname}${location.search}${location.hash}`);
    ga('send', 'pageview');

    {
      const search = {
        size: 20,
        sort: [
          { _score: 'desc' },
          { discovered_at: 'desc' }
        ],
        query: {
          bool: {
            filter
          }
        }
      }
      if (q.value) {
        //search.query.bool.must = [ { match: { name: q.value } } ]
        search.query.bool.should = [
          { match       : { name: q.value } },
          { match_phrase: { name: q.value } },
          { term        : { _id : q.value } }
        ]
      }
      const _q = b64EncodeUnicode(JSON.stringify(search))
      const response = await fetch(`${API_ROOT}/search/?${Qs.stringify({q: _q})}`)
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

function recognizeQ() {
  const q = {}
  q.value = queryInHash().q
  if (!q) {
    q.value = Qs.parse(location.search.slice(1)).q
  }
  window.search.value = q.value || ''
  q.title = q.value || 'Movie, TV, Anime'
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

class Provider {
  constructor() {
    this.base = 'https://www.premiumize.me/api'
    this.pin  = '9p9pkpjf3yccyn5i'
    this.transfers          = new Map
    this.transferWatchers   = new Set
  }
  async fetch(endpoint, options) {
    options = options || {}
    options.query = options.query || {}
    options.query.pin = this.pin
    const querystring = Qs.stringify(options.query)
    if (options.body) {
      const form = new FormData
      const fields = Object.keys(options.body)
      for (const field of fields) {
        form.append(field, options.body[field])
      }
      options.body = form
    }
    const response = await fetch(
      `${this.base}${endpoint}?${querystring}`,
      {
        method: options.method,
        mode: 'cors',
        body: options.body
      }
    )
    return await response.json()
  }

  async syncTransfers() {
    const {transfers} = await this.fetch('/transfer/list')
    for (const transfer of transfers) {
      this.transfers.set(transfer.id, transfer)
    }
    return transfers
  }

  async watchTransfers(callback) {
    this.transferWatchers.add(callback)
    if (this.transferWatchers.size > 1) {
      // delegate
      return
    }
    while (this.transferWatchers.size) {
      await this.syncTransfers()
      for (const callback of this.transferWatchers) {
        callback()
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  async watchTransfer(id, callback) {
    //await this.syncTransfers()
    //const transfer = this.transfers.get(id)
    //if (transfer) {
      //callback(transfer)
      //if ('finished' === transfer.status) {
        //return
      //}
    //}

    // add watcher
    const watcher = () => {
      const transfer = this.transfers.get(id)
      if (!transfer) {
        return
      }
      if ('finished' === transfer.status) {
        this.transferWatchers.delete(watcher)
      }
      callback(transfer)
    }
    this.watchTransfers(watcher)
  }
}

const provider = new Provider

// https://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
function generateUUID() { // Public Domain/MIT
  var d = new Date().getTime();
  if (typeof performance !== 'undefined' && typeof performance.now === 'function'){
    d += performance.now(); //use high-precision timer if available
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		var r = (d + Math.random() * 16) % 16 | 0;
		d = Math.floor(d / 16);
		return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
const SESSION_ID = generateUUID()

async function watch(element) {

  gtag_report_conversion()
  element.innerText = 'Transferring'
  element.disabled  = true
  const progress = element.parentNode.querySelector('[data-role="progress"]')
  progress.hidden = false
  const progressBar = progress.firstElementChild

  const {infohash, magnet, name} = element.parentNode.parentNode.dataset
  //const src = magnet.replace(/btih:(.*)&.*$/, 'btih:$1&dn=$1')

  const {id: folder_id} = await provider.fetch(
    '/folder/create',
    {method: 'POST', body: {name: SESSION_ID}}
  )
  let transfer = await provider.fetch(
    '/transfer/create',
    {method: 'POST', body: {src: magnet, folder_id}}
  )
  if ('error' === transfer.status && 'You have reached the maximum of 25 active download jobs. Please wait or abort an old one.' === transfer.message) {
    const transfers = await provider.syncTransfers()
    const transferToAbort = transfers.reverse().find((transfer) => /. ETA is unknown$/.test(transfer.message))
    await provider.fetch('/transfer/delete', {method: 'POST', body: {id: transferToAbort.id}})
    transfer = await provider.fetch(
      '/transfer/create',
      {method: 'POST', body: {src: magnet, folder_id}}
    )
  }

  provider.watchTransfer(transfer.id, (transfer) => {
    const percent = (transfer.progress * 100).toFixed(2)
    progressBar.style.width = `${percent}%`
    element.innerText = `Transferring (${percent}%)...`

    if ('finished' !== transfer.status) {
      return
    }
    complete(transfer)
  })

  async function complete(transfer) {
    element.hidden = true
    progress.hidden = true
    const ul = element.parentNode.querySelector('ul[data-role="video-list"]')
    const {content: files} = await provider.fetch(
      '/folder/list',
      {query: {id: transfer.folder_id}}
    )
    const videos = files ? files.filter(file => file.stream_link) : []
    nunjucks.render('video-list.html', {videos}, (error, html) => {
      ul.innerHTML = html
    })
    ul.hidden = false
    provider.fetch('/transfer/clearfinished', {method: 'POST'})
  }

}

function submit(event) {
  event.preventDefault()
  document.activeElement.blur()
  location.hash = `#/?q=${encodeURIComponent(search.value)}`
}
