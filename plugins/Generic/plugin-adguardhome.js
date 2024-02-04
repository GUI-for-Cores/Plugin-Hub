const data = "data/third/AdGuardHome"; // AdGuardHome主目录
const pidfile = data + "/pid.txt"; // 运行时PID
const execfile = data + "/AdGuardHome.exe"; // 主程序
const execargs = []; // 运行时参数
const version = "v0.107.43"; // 版本，可自行更改升级
const cachefile = `data/.cache/adguard_${version}.zip`; // 主程序压缩文件
const backup_config_file = "data/third/AdGuardHome.yaml.bak"; // 备份的配置文件
window.pluginAdguardHome = window.pluginAdguardHome || {
  admin_address: "",
};

const { arch } = await Plugins.GetEnv();

const url = `https://github.com/AdguardTeam/AdGuardHome/releases/download/${version}/AdGuardHome_windows_${arch}.zip`;

/* 停止运行AdGuardHome */
const stopAdGuardHome = async () => {
  const pid = await Plugins.Readfile(pidfile);
  const name = await Plugins.ProcessInfo(Number(pid));
  if (name.startsWith("AdGuardHome")) {
    await Plugins.KillProcess(Number(pid));
  }
  await Plugins.Removefile(pidfile);
};

/* 运行AdGuardHome */
const runAdGuardHome = async () => {
  const pid = await Plugins.ExecBackground(
    execfile,
    execargs,
    (out) => {
      if (out.includes("go to") && out.includes("127.0.0.1")) {
        window.pluginAdguardHome.admin_address = out.split("go to")[1].trim();
        Plugins.message.success(
          "AdGuardHome管理地址：" + window.pluginAdguardHome.admin_address,
          5_000
        );
      }
      if (out.includes("dnsproxy: listening to")) {
        Plugins.message.success(
          "AdGuardHome服务地址：" + out.split("dnsproxy: listening to")[1],
          5_000
        );
      }
    },
    async () => {
      console.log("AdGuardHome.exe stopped");
      await Plugins.Removefile(pidfile);
    }
  );
  await Plugins.Writefile(pidfile, pid.toString());
};

/* 安装AdGuardHome */
const installAdGuardHome = async () => {
  if (!(await Plugins.FileExists(cachefile))) {
    const { id } = Plugins.message.info("下载AdGuardHome压缩包")
    await Plugins.Download(url, cachefile, (progress, total) => {
      Plugins.message.update(id, '下载AdGuardHome压缩包：' + ((progress / total) * 100).toFixed(2) + '%')
    })
    console.log("下载AdGuardHome完成");
  }
  console.log("解压AdGuardHome压缩包");
  await Plugins.UnzipZIPFile(cachefile, "data/third");
  console.log("解压AdGuardHome完成");
};

/* 卸载AdGuardHome */
const uninstallAdGuardHome = async () => {
  if (await Plugins.FileExists(pidfile)) {
    throw "请先停止运行AdGuardHome";
  }
  await Plugins.Removefile(data);
};

const onInstall = async () => {
  await installAdGuardHome();
};

const onUninstall = async () => {
  await uninstallAdGuardHome();
};

// 默认不启用，请在插件编辑里勾选对应的触发器
const onStartup = async () => {
  if (await Plugins.FileExists(pidfile)) {
    const pid = await Plugins.Readfile(pidfile);
    try {
      const name = await Plugins.ProcessInfo(Number(pid));
      if (name.startsWith("AdGuardHome")) {
        return;
      }
      await Plugins.Removefile(pidfile);
    } catch (error) {}
  }
  await runAdGuardHome();
};

// 默认不启用，请在插件编辑里勾选对应的触发器
const onShutdown = async () => {
  if (!(await Plugins.FileExists(pidfile))) {
    return;
  }
  await stopAdGuardHome();
};

/* 菜单项 - 访问管理界面 */
const openAdguardHome = async () => {
  if (!(await Plugins.FileExists(pidfile))) {
    throw "请先运行AdGuardHome";
  }
  Plugins.BrowserOpenURL(
    window.pluginAdguardHome.admin_address || "http://127.0.0.1:3000/"
  );
};

/* 菜单项 - 备份配置 */
const backupConfig = async () => {
  if (!(await Plugins.FileExists(data + "/AdGuardHome.yaml"))) {
    throw "没有可备份的配置文件";
  }
  // TODO: copy file
  const config_content = await Plugins.Readfile(data + "/AdGuardHome.yaml");
  await Plugins.Writefile(backup_config_file, config_content);
  Plugins.message.success("配置文件备份成功");
};

/* 菜单项 - 恢复配置 */
const restoreConfig = async () => {
  if (!(await Plugins.FileExists(backup_config_file))) {
    throw "没有可恢复的配置文件";
  }
  if (await Plugins.FileExists(pidfile)) {
    throw "请先停止运行AdGuardHome";
  }
  // TODO: copy file
  const config_content = await Plugins.Readfile(backup_config_file);
  await Plugins.Writefile(data + "/AdGuardHome.yaml", config_content);
  Plugins.message.success("配置文件恢复成功");
};

const onRun = async () => {
  if (await Plugins.FileExists(pidfile)) {
    await stopAdGuardHome();
    Plugins.message.success("AdGuardHome停止成功");
  } else {
    await runAdGuardHome();
  }
};
