window[Plugin.id] = window[Plugin.id] || initMusicClient()

const onRun = async () => {
  await startMusicServer()
  window[Plugin.id].modal.open()
}

const startMusicServer = async () => {
  await stopMusicServer().catch((err) => {
    console.log(`[${Plugin.name}]`, '停止失败', err)
  })
  await Plugins.StartServer(
    '127.0.0.1:53421',
    Plugin.id,
    (req, res) => {
      res.end('音乐静态资源服务器运行中')
    },
    {
      StaticPath: Plugin.MusicDir,
      StaticHeaders: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*'
      }
    }
  )
}

const stopMusicServer = async () => {
  await Plugins.StopServer(Plugin.id)
}

function createUIModal() {
  const component = {
    template: `
    <div class="relative flex flex-col h-full justify-end">
      <canvas ref="canvas" class="absolute inset-0 w-full h-full"></canvas>
      <div class="absolute left-8 right-8 flex justify-between" style="top: 50%; transform: translateY(-50%)">
        <Button type="text" size="large" icon="backward" @click="prev" />
        <Button type="text" class="flex items-center justify-center w-128 h-128 rounded-full" @click="toggle">
          <Icon :icon="isPlaying ? 'pause' : 'play'" :size="80" color="var(--color)" />
        </Button>
        <Button type="text" size="large" icon="forward" @click="next" />
      </div>
      <div class="absolute left-8 right-8 bottom-0 z-9">
        <Progress :percent="percent" />
      </div>
    </div>
    `,
    setup(_, { expose }) {
      const { analyser, dataArray, playList, isPlaying, title, percent, play, index, toggle, prev, next, refreshPlayList, modal } = window[Plugin.id]
      const { h, ref, resolveComponent, onMounted, onUnmounted } = Vue

      let animationId
      const canvas = ref()
      const appSettings = Plugins.useAppSettingsStore()

      onMounted(() => {
        const ctx = canvas.value.getContext('2d')
        canvas.value.width = canvas.value.clientWidth
        canvas.value.height = canvas.value.clientHeight

        let t = 0
        let rot = 0

        function draw() {
          animationId = requestAnimationFrame(draw)
          analyser.getByteFrequencyData(dataArray)
          rot += 0.001 // 自转速度
          t += 0.005

          const style = getComputedStyle(document.documentElement)
          const primaryColor = style.getPropertyValue('--primary-color')
          const secondaryColor = style.getPropertyValue('--secondary-color')

          ctx.fillStyle = appSettings.themeMode === 'light' ? '#F6F6F6' : '#343434'
          ctx.fillRect(0, 0, canvas.value.width, canvas.value.height)

          const cx = canvas.value.width / 2
          const cy = canvas.value.height / 2

          let energy = 0
          for (let i = 0; i < 50; i++) energy += dataArray[i]
          energy = energy / 50 / 255

          let planet = 80 + energy * 50 + Math.sin(t) * 8

          // 星球
          let planetGrad = ctx.createRadialGradient(cx - 40, cy - 40, 20, cx, cy, planet)
          planetGrad.addColorStop(0, primaryColor || '#d6f0ff')
          planetGrad.addColorStop(1, secondaryColor || '#3a5cff')

          ctx.beginPath()
          ctx.fillStyle = planetGrad
          ctx.arc(cx, cy, planet, 0, Math.PI * 2)
          ctx.fill()

          // 星环
          const rings = 200
          for (let i = 0; i < rings; i++) {
            let angle = (i / rings) * Math.PI * 2 + rot

            let dataIdx = i > rings / 2 ? rings - i : i
            let f = dataArray[dataIdx] / 255

            let wave = Math.sin(angle * 3 + t * 5) * 12

            let r = planet + 30 + f * 40 + wave

            let x = cx + Math.cos(angle) * r
            let y = cy + Math.sin(angle) * r

            ctx.fillStyle = secondaryColor || `rgba(180,210,255,0.7)`
            ctx.fillRect(x, y, 2, 2)
          }

          // 星尘
          for (let i = 0; i < 50; i++) {
            let a = (i / 50) * Math.PI * 2 + rot * 2
            let r = 200 + Math.sin(t + i) * 50
            let x = cx + Math.cos(a) * r
            let y = cy + Math.sin(a) * r

            ctx.fillStyle = primaryColor || 'rgba(100,150,255,0.3)'
            ctx.fillRect(x, y, 2, 2)
          }
        }

        draw()
      })

      onUnmounted(() => {
        cancelAnimationFrame(animationId)
      })

      refreshPlayList()

      const Dropdown = resolveComponent('Dropdown')
      const Button = resolveComponent('Button')

      expose({
        modalSlots: {
          default: () => h(component),
          toolbar: () =>
            h(
              Button,
              {
                type: 'text',
                onClick() {
                  modal.close()
                }
              },
              () => '进入后台'
            ),
          action: () =>
            h(
              'div',
              { class: 'mr-auto' },
              h(
                Dropdown,
                {
                  placement: 'top'
                },
                {
                  overlay: ({ close }) =>
                    h(
                      'div',
                      {
                        class: 'flex flex-col gap-4 min-w-64 p-4'
                      },
                      playList.value.map((v, i) => {
                        return h(
                          Button,
                          {
                            type: index.value === i ? 'link' : 'text',
                            onClick() {
                              index.value = i
                              play()
                              close()
                            }
                          },
                          () => v.name
                        )
                      })
                    ),
                  default: () =>
                    h(
                      Button,
                      {
                        type: 'link'
                      },
                      () => title.value
                    )
                }
              )
            )
        }
      })

      return {
        canvas,
        isPlaying,
        percent,
        toggle,
        prev,
        next
      }
    }
  }

  const modal = Plugins.modal({
    title: Plugin.name,
    width: '90',
    height: '90',
    submit: false,
    cancelText: '退出',
    afterClose() {
      window[Plugin.id].destroy()
      window[Plugin.id] = null
      modal.destroy()
      stopMusicServer()
    }
  })

  modal.setContent(component)

  return modal
}

function initMusicClient() {
  const audioCtx = new AudioContext()
  const analyser = audioCtx.createAnalyser()
  const bufferLength = analyser.frequencyBinCount
  const dataArray = new Uint8Array(bufferLength)

  const audio = new Audio()
  analyser.fftSize = 1024
  audio.crossOrigin = 'anonymous'
  audio.playbackRate = 2

  const src = audioCtx.createMediaElementSource(audio)
  src.connect(analyser)
  analyser.connect(audioCtx.destination)

  const { ref, computed } = Vue
  const loopMode = ref('list') // 'one' | 'list' | 'none'
  const playList = ref([])
  const playing = ref(false)
  const waiting = ref(false)
  const isPlaying = computed(() => playing.value && !waiting.value)
  const index = ref(0)
  const percent = ref(0)
  const title = ref('歌曲列表')

  audio.onplay = () => {
    playing.value = true
  }
  audio.onplaying = () => {
    playing.value = true
    waiting.value = false
  }
  audio.onpause = () => {
    playing.value = false
  }
  audio.onended = () => {
    playing.value = false
    if (loopMode.value === 'one') {
      play()
      return
    }

    if (loopMode.value === 'list') {
      const nextIndex = index.value + 1
      if (nextIndex < playList.value.length) {
        index.value = nextIndex
      } else {
        index.value = 0
      }
      play()
    }
  }
  audio.onwaiting = () => {
    waiting.value = true
  }
  audio.ontimeupdate = (e) => {
    const { currentTime, duration } = e.target
    percent.value = (currentTime / duration) * 100
  }

  const play = () => {
    const song = playList.value[index.value]
    if (song) {
      title.value = song.name
      audio.src = song.url
      audio.play()
      audioCtx.resume()
    }
  }

  const toggle = () => {
    if (!audio.src) {
      play()
    } else {
      audio.paused ? audio.play() : audio.pause()
    }
  }

  const prev = () => {
    index.value = Math.max(index.value - 1, 0)
    play()
  }

  const next = () => {
    index.value = Math.min(index.value + 1, playList.value.length - 1)
    play()
  }

  const refreshPlayList = async () => {
    if (!Plugin.MusicDir) {
      Plugins.message.info('请配置音乐文件夹')
      return
    }
    const files = await Plugins.ReadDir(Plugin.MusicDir)
    playList.value = files
      .filter((file) => !file.isDir)
      .map((file) => {
        file.url = 'http://127.0.0.1:53421/static/' + file.name
        return file
      })
  }

  const destroy = () => {
    // 停止音频播放
    audio.pause()
    audio.src = ''
    audio.onplay = null
    audio.onpause = null
    audio.onplaying = null
    audio.onended = null
    audio.ontimeupdate = null
    audio.onwaiting = null

    // 断开 AudioContext 节点
    try {
      src.disconnect()
      analyser.disconnect()
      audioCtx.close()
    } catch (err) {
      console.warn('AudioContext already closed or disconnect failed', err)
    }
  }

  return {
    modal: createUIModal(),
    playList,
    playing,
    waiting,
    isPlaying,
    index,
    percent,
    title,
    audioCtx,
    analyser,
    dataArray,
    audio,
    src,
    play,
    prev,
    next,
    toggle,
    destroy,
    refreshPlayList
  }
}
