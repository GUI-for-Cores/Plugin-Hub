const onRun = async () => {
  const { id } = Plugins.message.info("正在进行检测", 10 * 60 * 1000);

  await Plugins.sleep(500);
  Plugins.message.update(id, "检测环境变量");
  const env = await Plugins.GetEnv();
  const { systemProxy } = Plugins.useEnvStore();
  const { config } = Plugins.useKernelApiStore();

  await Plugins.sleep(500);
  Plugins.message.update(id, "检测运行权限");
  const isAdmin = await Plugins.CheckPermissions();

  await Plugins.sleep(500);
  Plugins.message.update(id, "检测APP设置");
  const { app } = await Plugins.useAppSettingsStore();

  await Plugins.sleep(500);
  Plugins.message.update(id, "检测网络连通性");
  let baiduSuccess, googleSuccess;
  for (let i = 0; i < 3; i++) {
    try {
      await Plugins.HttpGet("http://baidu.com");
      baiduSuccess = true;
      break;
    } catch (error) {}
  }
  for (let i = 0; i < 3; i++) {
    try {
      await Plugins.HttpGet("http://google.com");
      googleSuccess = true;
      break;
    } catch (error) {}
  }

  await Plugins.sleep(500);
  Plugins.message.update(id, "检测完毕", 'success');

  const result = `====系统环境====
客户端：${Plugins.APP_TITLE} ${Plugins.APP_VERSION}
路径：${env.basePath}\\${env.appName}
系统：${env.os}-${env.arch} level: ${env.x64Level}
权限：${isAdmin ? "管理员" : "普通用户"}

====内核信息====
分支：${app.kernel.branch}
运行状态：${app.kernel.running ? "运行中" : "已停止"}
自动配置/清除系统代理：${app.autoSetSystemProxy ? "是" : "否"}
系统代理：${systemProxy ? "已设置" : "未设置"}
TUN模式：${config.tun.enable ? "已开启" : "已关闭"} 【${
    config.tun.device
  }】 【${config.tun.stack}】
IPv6：${config.ipv6 ? "已开启" : "已关闭"}
运行模式：${config.mode}

===网络信息===
百度连通性：${baiduSuccess ? "OK" : "Fail"}
谷歌连通性：${googleSuccess ? "OK" : "Fail"}
`;

  try {
    await Plugins.confirm('报告信息', result)
    await Plugins.ClipboardSetText(result);
    await Plugins.sleep(500);
    Plugins.message.update(id, "检测结果已复制到剪切板");
  } catch (error) {}
  await Plugins.sleep(500);
  Plugins.message.destroy(id);
};
