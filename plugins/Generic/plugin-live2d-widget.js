/**
 * 本插件使用项目：https://github.com/stevenjoezhang/live2d-widget
 * 另外：插件系统不推荐动态载入js、css，因此此插件并不符合规范！
 */

const loadLive2DWidget = () => {
  const scritp = document.createElement('script')
  scritp.innerHTML = /* javascript */ `
    // live2d_path 参数建议使用绝对路径
  const live2d_path = "https://fastly.jsdelivr.net/gh/stevenjoezhang/live2d-widget@latest/";
  //const live2d_path = "/live2d-widget/";
  
  // 封装异步加载资源的方法
  function loadExternalResource(url, type) {
      return new Promise((resolve, reject) => {
          let tag;
  
          if (type === "css") {
              tag = document.createElement("link");
              tag.rel = "stylesheet";
              tag.href = url;
          }
          else if (type === "js") {
              tag = document.createElement("script");
              tag.src = url;
          }
          if (tag) {
              tag.onload = () => resolve(url);
              tag.onerror = () => reject(url);
              document.head.appendChild(tag);
          }
      });
  }
  
  // 加载 waifu.css live2d.min.js waifu-tips.js
  if (screen.width >= 768) {
      Promise.all([
          loadExternalResource(live2d_path + "waifu.css", "css"),
          loadExternalResource(live2d_path + "live2d.min.js", "js"),
          loadExternalResource(live2d_path + "waifu-tips.js", "js")
      ]).then(() => {
          // 配置选项的具体用法见 README.md
          initWidget({
              waifuPath: live2d_path + "waifu-tips.json",
              //apiPath: "https://live2d.fghrsh.net/api/",
              cdnPath: "https://fastly.jsdelivr.net/gh/fghrsh/live2d_api/",
              tools: ["switch-model", "switch-texture", "quit"]
          });
      });
  };
  `
  document.body.appendChild(scritp)
}

const onRun = () => {
  loadLive2DWidget()
}

const onStartup = () => {
  loadLive2DWidget()
}
