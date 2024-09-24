const onRun = async () => {
  const input = await Plugins.prompt(Plugin.name, '')
  const { status, body } = await Plugins.HttpPost(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${Plugin.API_KEY}`,
    { 'Content-Type': 'application/json' },
    {
      system_instruction: {
        parts: {
          text: ''
        }
      },
      contents: {
        parts: {
          text: input
        }
      }
    }
  )
  if (status !== 200) {
    throw body.error.status + ' => ' + body.error.message
  }

  const text = body.candidates[0].content.parts[0].text

  await Plugins.alert(Plugin.name, text)

  await onRun()
}
