/* Trigger on::manual */
const onRun = async () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    throw '你的浏览器不支持该操作'
  }

  const displayMediaOptions = {
    video: {
      cursor: Plugin.CursorMode
    }
  }

  try {
    const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions)
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=h264') ? 'video/webm;codecs=h264' : 'video/webm'
    const mediaRecorder = new MediaRecorder(stream, { mimeType: mime })
    const chunks = []
    mediaRecorder.addEventListener('dataavailable', (e) => chunks.push(e.data))
    mediaRecorder.addEventListener('stop', () => {
      const blob = new Blob(chunks, { type: chunks[0].type })
      const fileName = Plugins.formatDate(Date.now(), Plugin.FileNameFormat)

      if (Plugin.FileSaveMode === 'browser') {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        a.click()
      } else {
        const reader = new FileReader()
        reader.readAsDataURL(blob)
        reader.onload = async (e) => {
          const result = e.target.result
          await Plugins.Writefile(Plugin.FileSavePath + '/' + fileName, result.slice(result.indexOf('base64') + 7), { Mode: 'Binary' })
          Plugins.message.success('已保存')
        }
      }
    })

    const delay = Number(Plugin.DelayTime)
    if (delay !== 0) {
      let i = delay
      const { update, destroy } = Plugins.message.info(String(i))
      while (i > 0) {
        update(String(i))
        i -= 1
        await Plugins.sleep(1000)
      }
      destroy()
    }

    setTimeout(() => {
      mediaRecorder.start()
    }, delay)
  } catch (error) {
    throw error.message || error
  }
}

const OpenFolder = async () => {
  const path = await Plugins.AbsolutePath(Plugin.FileSavePath)
  Plugins.BrowserOpenURL(path)
}
