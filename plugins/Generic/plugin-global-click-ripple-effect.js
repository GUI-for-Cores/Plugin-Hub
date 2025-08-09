/* 触发器 APP就绪后 */
const onReady = async () => {
  const style = document.createElement('style')
  const className = `${Plugin.id}-ripple`
  style.textContent = `
    .${className} {
        position: fixed;
        border-radius: 50%;
        transform: scale(0);
        pointer-events: none;
        opacity: 1;
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

  document.addEventListener('click', (e) => {
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
  })
}
