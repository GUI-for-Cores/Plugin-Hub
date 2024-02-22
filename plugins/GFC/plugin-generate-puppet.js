const addProfile = async () => {
  const url = prompt(
    "请输入你的配置文件路径，例如：C:\\Users\\Admin\\Desktop\\config.yaml"
  );
  if (!url || !url.trim()) {
    throw "缺少配置文件路径";
  }
  const config = Plugins.YAML.parse(await Plugins.Readfile(url));
  const profilesStore = Plugins.useProfilesStore();
  const id = Plugins.sampleID();
  const name = "[傀儡配置]" + id;
  const profile = getDefaultProfile();
  profile.id = id;
  profile.name = name;
  profile.plugin = "plugin-puppet-" + id;
  if (config["external-controller"]) {
    profile.advancedConfig["external-controller"] =
      config["external-controller"];
  }
  if (config["secret"]) {
    profile.advancedConfig["secret"] = config["secret"];
  }
  await profilesStore.addProfile(profile);
  const pluginsStore = Plugins.usePluginsStore();

  const plugin = getDefaultPlugin();
  plugin.id = "plugin-puppet-" + id;
  plugin.name = name + "_对应插件";
  plugin.description =
    "配置：" + name + "的对应插件，用于在生成配置文件时使用自定义的配置文件。";
  plugin.path = "data/plugins/" + plugin.id + ".js";
  const code = `
  // 自动生成的插件：作用于傀儡配置【${profile.name}】
  // 请勿手动修改本插件的源码
  const onGenerate = async (config, metadata) => {
    if(metadata.name === '${profile.name}') {
      const c = Plugins.YAML.parse(await Plugins.Readfile('${url.replaceAll(
        "\\",
        "\\\\"
      )}'))
      let needUpdateProfile = false
      if(metadata.advancedConfig['secret'] !== c.secret) {
        metadata.advancedConfig['secret'] = c.secret
        needUpdateProfile = true
      }
      if(metadata.advancedConfig['external-controller'] !== c['external-controller']) {
        metadata.advancedConfig['external-controller'] = c['external-controller']
        needUpdateProfile = true
      }
      if(needUpdateProfile) {
        const profilesStore = Plugins.useProfilesStore()
        profilesStore.editProfile(metadata.id, metadata)
      }
      return c
    }
    return config
  }
  `;
  await Plugins.Writefile(plugin.path, code);
  await pluginsStore.addPlugin(plugin);
  const _p = pluginsStore.getPluginById(plugin.id);
  await pluginsStore.reloadPlugin(_p, code);
  await pluginsStore.updatePluginTrigger(_p);
  Plugins.message.success("生成傀儡配置成功");
};

const delProfile = async () => {
  const profilesStore = Plugins.useProfilesStore();
  const ids = await Plugins.picker.multi(
    "请选择要删除的傀儡配置，同时将删除对应的插件",
    profilesStore.profiles
      .filter((v) => v.name.startsWith("[傀儡配置]"))
      .map((v) => ({ label: v.name, value: v.id })),
    []
  );
  const pluginsStore = Plugins.usePluginsStore();
  for (let i = 0; i < ids.length; i++) {
    const p = profilesStore.getProfileById(ids[i]);
    const _p = pluginsStore.getPluginById(p.plugin);
    await Plugins.Removefile(_p.path);
    await pluginsStore.deletePlugin(p.plugin);
    await profilesStore.deleteProfile(ids[i]);
  }
  Plugins.message.success("删除傀儡配置成功");
};

const onRun = async () => {
  const action = await Plugins.picker.single(
    "请选择操作类型",
    [
      { label: "添加傀儡配置", value: "add" },
      { label: "删除傀儡配置", value: "del" },
    ],
    ["add"]
  );

  if (action == "add") {
    await addProfile();
  }

  if (action == "del") {
    await delProfile();
  }
};

function getDefaultProfile() {
  return {
    id: "",
    name: "",
    generalConfig: {
      mode: "rule",
      ipv6: false,
      "mixed-port": 20112,
      "allow-lan": true,
      "log-level": "silent",
      "interface-name": "",
    },
    advancedConfig: {
      port: 0,
      "socks-port": 0,
      secret: "",
      "external-controller": "",
      "external-ui": "",
      "keep-alive-interval": 30,
      "find-process-mode": "strict",
      "external-controller-tls": "",
      "external-ui-name": "",
      "external-ui-url": "",
      "unified-delay": true,
      "tcp-concurrent": true,
      authentication: [],
      "skip-auth-prefixes": [],
      tls: {
        certificate: "",
        "private-key": "",
      },
      "global-client-fingerprint": "chrome",
      "geodata-mode": true,
      "geo-auto-update": false,
      "geo-update-interval": 24,
      "geodata-loader": "standard",
      "geox-url": {
        geoip: "",
        geosite: "",
        mmdb: "",
      },
      "global-ua": "chrome",
      profile: {
        "store-selected": true,
        "store-fake-ip": true,
      },
      "lan-allowed-ips": [],
      "lan-disallowed-ips": [],
    },
    tunConfig: {
      enable: false,
      stack: "gVisor",
      "auto-route": true,
      "auto-detect-interface": true,
      "dns-hijack": [],
      device: "utun_clash",
      mtu: 9000,
      "strict-route": true,
      "endpoint-independent-nat": false,
    },
    dnsConfig: {
      enable: false,
      listen: "",
      ipv6: false,
      "use-hosts": true,
      "default-nameserver": [],
      nameserver: [],
      "proxy-server-nameserver": [],
      "enhanced-mode": "fake-ip",
      "fake-ip-range": "198.18.0.1/16",
      "fake-ip-filter": [],
      fallback: [],
      "fallback-filter": {
        geoip: true,
        "geoip-code": "CN",
        geosite: [],
        ipcidr: [],
        domain: [],
      },
      "prefer-h3": false,
      "nameserver-policy": {},
    },
    proxyGroupsConfig: [],
    rulesConfig: [],
  };
}

function getDefaultPlugin() {
  return {
    id: "",
    name: "",
    description: "",
    type: "File",
    url: "",
    path: "",
    triggers: ["on::generate"],
    menus: {},
    disabled: false,
    install: false,
    installed: false,
  };
}
