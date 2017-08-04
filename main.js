const now = new Date
const loading = window.results.innerHTML
const client = new elasticsearch.Client({host: 'https://torrdb.zhongzi.io'})

async function refetch() {
  window.results.innerHTML = loading
  const search = location.hash.slice(location.hash.indexOf('?') + 1)
  let {q} = Qs.parse(search)
  q = q || '电影'
  window.search.value = q
  const results = await client.search({
    index: 'torrdb',
    type: 'torrent',
    body: {
      query: {
        bool: {
          should: [
            {
              match_phrase: {
                name: q
              }
            },
            {
              match: {
                name: `720P 1080P 1280P HD FHD BD 高清 全高清 超清 超高清 ${now.getFullYear()}`
              }
            },
          ],
          filter: [
            {
              match: {
                name: q
              }
            },
            {
              terms: {
                extnames: [ 'mp4', 'mpg', 'avi', 'mkv', 'rmvb', 'rm' ]
              }
            }
          ]
        }
      }
    }
  })

  nunjucks.configure({
    web: { async: true },
    autoescape: true
  })

  nunjucks.render('template.html', results, (error, html) => {
    window.results.innerHTML = html
  })
}

refetch()
window.addEventListener("hashchange", refetch)

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
window['search-form'].addEventListener('submit', submit)
