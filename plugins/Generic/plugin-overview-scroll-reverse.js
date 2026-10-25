export default () => {
  const kernel = Plugins.useKernelApiStore()
  const settings = Plugins.useAppSettingsStore()
  let lastButton = null
  let lastAt = 0
  let count = 0

  const onWheel = (event) => {
    const home = event.target instanceof Element ? event.target.closest('.home-view') : null
    const panel = home?.querySelector('.controller-panel')
    if (!panel || !kernel.running || event.ctrlKey || !event.deltaY || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return

    // Suppress the built-in gesture while preserving native list scrolling.
    event.stopPropagation()
    const open = panel.classList.contains('translate-y-0')
    let button = null
    if (!open && event.deltaY < 0) {
      button = home.querySelector('.controller-trigger [role="button"]')
    } else if (open && event.deltaY > 0 && settings.app.kernel.controllerCloseMode === 'all') {
      // Closing at the bottom leaves downward scrolling available inside the list.
      if (panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 1) {
        button = home.querySelector('.controller-close')
      }
    }
    if (!button) {
      count = 0
      return
    }
    const now = performance.now()
    if (button !== lastButton || now - lastAt > 100) count = 0
    lastButton = button
    lastAt = now
    if (++count >= settings.app.kernel.controllerSensitivity) {
      count = 0
      button.click()
    }
  }

  const start = () => {
    document.addEventListener('wheel', onWheel, { capture: true, passive: true })
    return 1
  }
  const stop = () => {
    document.removeEventListener('wheel', onWheel, true)
    count = 0
    return 2
  }

  return {
    onReady: start,
    onEnabled: start,
    onRun: start,
    onDisabled: stop,
    onDispose: stop,
    onShutdown: stop
  }
}
