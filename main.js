async function refetch() {
  const search = location.hash.slice(location.hash.indexOf('?') + 1)
  let {q} = Qs.parse(search)
  q = q || '福利'
  window.search.value = q
  const client = new elasticsearch.Client({host: 'https://torrdb.zhongzi.io'})
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
            }
          ],
          filter: [
            {
              match: {
                name: q
              }
            },
            {
              terms: {
                extnames: [
                  'mp4',
                  'mpg',
                  'avi',
                  'mkv',
                  'rmvb',
                  'rm'
                ]
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

function magnet(element, event) {
  event.preventDefault()
  const input = element.querySelector('input')
  input.disabled = false
  input.select()
  document.execCommand('copy')
  input.disabled = true
  notie.alert({text: 'magnet has been copied to clipboard!'})
}

function submit(event) {
  event.preventDefault()
  location.hash = `#/?q=${encodeURIComponent(search.value)}`
}
window['search-form'].addEventListener('submit', submit)
