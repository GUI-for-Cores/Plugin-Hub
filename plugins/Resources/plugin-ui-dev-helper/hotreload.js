const domTemplate = document.getElementById('template')
const domScript = document.getElementById('script')
function sendPost() {
  const template = domTemplate.textContent
  const script = domScript.textContent

  fetch('http://127.0.0.1:28888/api/render', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: Token
    },
    body: JSON.stringify({ template, script })
  })
    .then((res) => {
      if (!res.ok) throw new Error('Failed to POST')
      return res.text()
    })
    .then(console.log)
    .catch((err) => console.error('POST error:', err))
}

const observer = new MutationObserver(sendPost)
const config = { childList: true, characterData: true, subtree: true }

observer.observe(domTemplate, config)
observer.observe(domScript, config)

sendPost()
