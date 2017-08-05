(() => {

  const now = new Date
  const loading = window.results.innerHTML
  const advises = `超高清 超清 1280P BD 全高清 1080P FHD 高清 720P HD ${now.getFullYear()}`
  const format = [ 'mkv', 'avi', 'mp4', 'mpg', 'mpeg', 'rmvb', 'rm', 'webm' ]
  const filter = [
    { terms: { extnames: format } },
    { match: { name: advises } },
  ]
  const qs = window.Qs

  nunjucks.configure({
    web: { async: true, useCache: true },
    autoescape: true
  })

  async function refetch() {
    window.results.innerHTML = loading
    const search = location.hash.slice(location.hash.indexOf('?') + 1)
    let {q} = qs.parse(search)
    q = q || '电影'
    window.search.value = q

    {
      const search = {
        query: {
          bool: {
            must:   [ { match:        { name: q } } ],
            should: [ { match_phrase: { name: q } } ],
            filter
          }
        }
      }
      const _q = b64EncodeUnicode(JSON.stringify(search))
      const response = await fetch(`https://api.zhongzi.io/search/?${qs.stringify({q: _q})}`)
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

function submit(event) {
  event.preventDefault()
  location.hash = `#/?q=${encodeURIComponent(search.value)}`
}
