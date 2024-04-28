const onRun = async () => {
  const rulesetsStore = Plugins.useRulesetsStore()

  const list = [
    // Built-In
    {
      id: 'direct',
      tag: 'direct',
      updateTime: '',
      type: 'Manual',
      format: 'source',
      url: '',
      path: 'data/rulesets/direct.json',
      disabled: false
    },
    {
      id: 'reject',
      tag: 'reject',
      updateTime: '',
      type: 'Manual',
      format: 'source',
      url: '',
      path: 'data/rulesets/reject.json',
      disabled: false
    },
    {
      id: 'proxy',
      tag: 'proxy',
      updateTime: '',
      type: 'Manual',
      format: 'source',
      url: '',
      path: 'data/rulesets/proxy.json',
      disabled: false
    },
    // https://github.com/MetaCubeX/meta-rules-dat/tree/sing
    {
      id: 'remote-reject',
      tag: '广告域名列表',
      updateTime: '',
      type: 'Http',
      format: 'binary',
      url: 'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/category-ads-all.srs',
      path: 'data/rulesets/remote-category-ads-all.srs',
      disabled: false
    },
    {
      id: 'remote-private',
      tag: '私有网络专用域名列表',
      updateTime: '',
      type: 'Http',
      format: 'binary',
      url: 'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/private.srs',
      path: 'data/rulesets/remote-private.srs',
      disabled: false
    },
    {
      id: 'remote-apple',
      tag: 'Apple 在中国大陆可直连的域名列表',
      updateTime: '',
      type: 'Http',
      format: 'binary',
      url: 'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/apple-cn.srs',
      path: 'data/rulesets/remote-apple-cn.srs',
      disabled: false
    },
    {
      id: 'remote-icloud',
      tag: 'iCloud 在中国大陆可直连的域名列表',
      updateTime: '',
      type: 'Http',
      format: 'binary',
      url: 'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/icloud@cn.srs',
      path: 'data/rulesets/remote-icloud-cn.srs',
      disabled: false
    },
    {
      id: 'remote-gfw',
      tag: 'GFW 域名列表',
      updateTime: '',
      type: 'Http',
      format: 'binary',
      url: 'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/gfw.srs',
      path: 'data/rulesets/remote-gfw.srs',
      disabled: false
    },
    {
      id: 'remote-tld-not-cn',
      tag: '非中国大陆使用的顶级域名列表',
      updateTime: '',
      type: 'Http',
      format: 'binary',
      url: 'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/tld-!cn.srs',
      path: 'data/rulesets/remote-tld-not-cn.srs',
      disabled: false
    },
    {
      id: 'remote-telegram-cidr',
      tag: 'Telegram 使用的 IP 地址列表',
      updateTime: '',
      type: 'Http',
      format: 'binary',
      url: 'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geoip/telegram.srs',
      path: 'data/rulesets/remote-telegram-cidr.srs',
      disabled: false
    },
    {
      id: 'remote-lan-cidr',
      tag: '局域网 IP 及保留 IP 地址列表',
      updateTime: '',
      type: 'Http',
      format: 'binary',
      url: 'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geoip/private.srs',
      path: 'data/rulesets/remote-private-cidr.srs',
      disabled: false
    },
    {
      id: 'remote-cn-cidr',
      tag: '中国大陆 IP 地址列表',
      updateTime: '',
      type: 'Http',
      format: 'binary',
      url: 'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geoip/cn.srs',
      path: 'data/rulesets/remote-cn-cidr.srs',
      disabled: false
    },
    {
      id: 'remote-cn',
      tag: '中国大陆域名列表',
      updateTime: '',
      type: 'Http',
      format: 'binary',
      url: 'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/cn.srs',
      path: 'data/rulesets/remote-cn.srs',
      disabled: false
    }
  ]

  const ids = await Plugins.picker.multi(
    '请选择你要添加的规则集',
    list.map((v) => ({ label: v.tag, value: v.id })),
    list.filter((v) => rulesetsStore.getRulesetById(v.id)).map((v) => v.id)
  )

  for (let i = 0; i < ids.length; i++) {
    if (!rulesetsStore.getRulesetById(ids[i])) {
      const ruleset = list.find((v) => v.id == ids[i])
      await rulesetsStore.addRuleset(ruleset)
      console.log('添加', ruleset.tag)
    }
  }

  if (ids.includes('direct') && !(await Plugins.FileExists('data/rulesets/direct.json'))) {
    Plugins.Writefile('data/rulesets/direct.json', '{\n  "version": 1,\n  "rules": []\n}')
  }
  if (ids.includes('reject') && !(await Plugins.FileExists('data/rulesets/reject.json'))) {
    Plugins.Writefile('data/rulesets/reject.json', '{\n  "version": 1,\n  "rules": []\n}')
  }
  if (ids.includes('proxy') && !(await Plugins.FileExists('data/rulesets/proxy.json'))) {
    Plugins.Writefile('data/rulesets/proxy.json', '{\n  "version": 1,\n  "rules": []\n}')
  }

  Plugins.message.success('添加完毕')
}
