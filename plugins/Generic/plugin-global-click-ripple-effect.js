const styleId = Plugin.id + '_style'
const className = `${Plugin.id}-ripple`

/** @type {EsmPlugin} */
export default (Plugin) => {
  const active = () => {
    addStyle()
    addListener()
  }

  const onReady = active
  const onInstall = onReady
  const onEnabled = onReady

  const onDispose = () => {
    delStyle()
    delListener()
  }

  return { onReady, onInstall, onDispose, onEnabled }
}

const addStyle = () => {
  const dom = document.getElementById(styleId)
  if (dom) return
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    .${className} {
        position: fixed;
        border-radius: 50%;
        transform: scale(0);
        pointer-events: none;
        opacity: 0.3;
        animation: ${className}-anim 600ms ease-out forwards;
        z-index: 999999;
    }
    @keyframes ${className}-anim {
        to {
            transform: scale(1);
            opacity: 0;
        }
    }
    `
  document.head.appendChild(style)
}

const delStyle = () => {
  document.getElementById(styleId)?.remove()
}

const addListener = () => {
  document.addEventListener('click', onDomClick)
}

const delListener = () => {
  document.removeEventListener('click', onDomClick)
}

const onDomClick = (e) => {
  const ripple = document.createElement('span')
  ripple.className = className
  const pC = document.documentElement.style.getPropertyValue('--primary-color')
  const sC = document.documentElement.style.getPropertyValue('--secondary-color')
  ripple.style.background = `radial-gradient(${sC}, ${pC})`

  const size = Math.max(window.innerWidth, window.innerHeight) * 0.5
  ripple.style.width = ripple.style.height = size + 'px'

  ripple.style.left = e.clientX - size / 2 + 'px'
  ripple.style.top = e.clientY - size / 2 + 'px'

  document.body.appendChild(ripple)

  ripple.addEventListener('animationend', () => ripple.remove(), { once: true })
}
