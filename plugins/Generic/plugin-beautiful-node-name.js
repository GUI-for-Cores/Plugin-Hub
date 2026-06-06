/**
 * 1. EnableSubscriptionName 是否允许订阅名称  比如节点 hk01，订阅名 xxx => xxx | hk 01
 * 2. EnableNationalEmoji 是否允许国旗，国旗emoji 会放在订阅名称后面 xxx | emoji hk 01
 * 3. EnableUnifyRegionName 是否统一地区名称，比如 hk01 => 香港 01，hk-tlw => 香港 02
 * 4. EnableCityName 是否显示具体的城市名（如果有的话）=> 香港 01 铜锣湾
 * 5. ReservedKeywords 是否保留节点名称中的除国家城市外的其他信息，有些节点是IPEL，那么加入IEPL|BGP|\\d+\\.\\d+，用分隔符隔开，支持正则
 * 结果可能是：机场 | 香港 01 铜锣湾 | BGP
 */

/* 手动触发 */
const onRun = async () => {
  let subscribesStore = Plugins.useSubscribesStore()
  if (subscribesStore.subscribes.length === 0) {
    throw '请添加订阅'
  }
  let subscription_list = await Plugins.picker.multi(
    '请选择要美化的订阅',
    subscribesStore.subscribes.map((v) => ({
      label: v.name,
      value: v
    })),
    []
  )
  await Promise.all(
    subscription_list.map(async (subscription) => {
      subscription.proxies = await beautifyNodeName(subscription.proxies, subscription)
      Plugins.message.success(`美化成功 [${subscription.name}]`)
    })
  )
}

/* 订阅时 */
const onSubscribe = async (proxies, metadata) => {
  return await beautifyNodeName(proxies, metadata)
}

/* 测试名称 */
const testName = async () => {
  const input = await Plugins.prompt('请输入要美化的节点名：', '', { placeholder: '订阅名（首行）\n节点名（第二行）', type: 'code' })
  const data = input.split('\n')
  const proxies = [{ tag: data[1], name: data[1], type: '' }]
  const metadata = { name: data[0] }
  const result = await beautifyNodeName(proxies, metadata)
  await Plugins.confirm('美化结果：', result[0].tag)
}

async function beautifyNodeName(proxies, metadata) {
  const enableSubscriptionName = Plugin.EnableSubscriptionName
  const enableNationalEmoji = Plugin.EnableNationalEmoji
  const enableUnifyRegionName = Plugin.EnableUnifyRegionName
  const enableCityName = Plugin.EnableCityName
  const reservedKeywords = Plugin.ReservedKeywords

  const regionRules = new Map()
  const subRegionRules = new Map()

  RegionData.forEach((region) => {
    region.keywords.forEach((keyword) => {
      regionRules.set(keyword.toLowerCase(), region)
    })
  })
  RegionData.forEach((region) => {
    region.subKeywords.forEach((keyword) => {
      subRegionRules.set(keyword.toLowerCase(), region)
    })
  })

  const emojiRegex = /[\u{1F1E6}-\u{1F1FF}]{2}/gu

  // 记录每个国家的节点数
  const countryCountMap = new Map()

  // 根据订阅设置过滤掉节点
  proxies = proxies.filter((v) => {
    const flag1 = metadata.include ? new RegExp(metadata.include).test(v.tag) : true
    const flag2 = metadata.exclude ? !new RegExp(metadata.exclude).test(v.tag) : true
    const flag3 = metadata.includeProtocol ? new RegExp(metadata.includeProtocol).test(v.type) : true
    const flag4 = metadata.excludeProtocol ? !new RegExp(metadata.excludeProtocol).test(v.type) : true
    return flag1 && flag2 && flag3 && flag4
  })

  const flag = Plugins.APP_TITLE.includes('SingBox') ? 'tag' : 'name'

  proxies = proxies.map((proxy) => {
    let tag = proxy[flag]
    let matchedRegion = null
    let subMatchedRegion = null

    // 检查是否包含 Emoji，并替换为空
    tag = tag
      .replace(emojiRegex, (match) => {
        const region = RegionData.find((c) => c.emoji === match)
        if (region) {
          matchedRegion = region
        }
        return ' '
      })
      .trim()

    let matchRegionName = ''
    for (const [keyword, region] of regionRules) {
      const [isChinese, regex] = createRegionRegex(keyword)
      const matchResult = tag.match(regex)
      if (matchResult) {
        matchRegionName = matchResult[0].replace(/^[-_]+|[-_]+$/g, '').trim()
        if (!matchedRegion) {
          matchedRegion = region
        }
        tag = tag.replace(regex, isChinese ? ' ' : '$1').trim()
        break
      }
    }

    // 匹配子地区（城市）
    for (const [subKeyword, region] of subRegionRules) {
      const [isChinese, regex] = createRegionRegex(subKeyword)
      if (tag.match(regex)) {
        if (!matchedRegion) {
          matchedRegion = region
        }
        subMatchedRegion = subKeyword
        tag = tag.replace(regex, isChinese ? ' ' : '$1').trim()
        break
      }
    }

    // 保留非关键字部分
    let parts = tag
      .replace(/^[^\p{L}\p{N}\p{Script=Han}]+|[^\p{L}\p{N}\p{Script=Han}]+$/gu, '')
      .replace(/[\s_\-.,|\\/;:]+/g, ' ')
      .trim()

    // 使用正则表达式匹配保留的关键词
    let matchedOtherInfo = []
    if (reservedKeywords && parts) {
      const keywords = reservedKeywords
        .split('|')
        .map((k) => k.trim())
        .filter(Boolean)
      keywords.forEach((keyword) => {
        const [_, regex] = createRegionRegex(keyword)
        const match = parts.match(regex)
        if (match) {
          matchedOtherInfo.push(match[0].trim())
        }
      })
    }

    // 最后处理：匹配地区成功才会有emoji
    if (matchedRegion) {
      let regionName = ''
      let serialNumber = ''

      // 根据 enableUnifyRegionName 的值选择语言
      regionName =
        enableUnifyRegionName === '统一为英文'
          ? matchedRegion.standardName['en']
          : enableUnifyRegionName === '统一为中文'
            ? matchedRegion.standardName['zh']
            : matchRegionName

      // 更新计数器
      const count = (countryCountMap.get(matchedRegion.emoji) || 0) + 1
      countryCountMap.set(matchedRegion.emoji, count)
      serialNumber = count.toString().padStart(2, '0')

      tag = [
        enableNationalEmoji ? matchedRegion.emoji : '',
        enableUnifyRegionName ? regionName : matchRegionName,
        serialNumber,
        enableCityName ? (subMatchedRegion ?? '') : ''
      ]
        .filter(Boolean)
        .join(' ')
      tag = matchedOtherInfo.length >= 1 ? tag + ' | ' + matchedOtherInfo.join(' ') : tag
      // console.log(tag)
    }
    const prefix = `${metadata.name} | `
    tag = enableSubscriptionName && !tag?.startsWith(prefix) ? prefix + tag : tag
    return { ...proxy, [flag]: tag ?? proxy[flag] }
  })
  const sort = enableUnifyRegionName === '统一为英文' ? 'en' : 'zh-Hans-CN'
  proxies.sort((a, b) => (a[flag] ?? '').localeCompare(b[flag] ?? '', sort, { numeric: true }))
  return proxies
}

function createRegionRegex(keyword) {
  const isChinese = /[\u4e00-\u9fa5]/.test(keyword)
  return [isChinese, isChinese ? new RegExp(`${escapeRegExp(keyword)}`, 'gi') : new RegExp(`(^|[^\\p{L}\\p{N}])${keyword}(?=[^\\p{L}]|$)`, 'gui')]
}

// 辅助函数：转义正则特殊字符
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const RegionData = [
  {
    keywords: ['🇭🇰', 'HK', '香港', '沪港', '呼港', '中港', 'HKT', 'HKBN', 'HGC', 'WTT', 'CMI', '穗港', '广港', '京港', 'Hongkong', 'Hong Kong'],
    subKeywords: ['九龙', '铜锣湾', '新界', 'Kowloon'],
    standardName: { zh: '香港', en: 'HK' },
    emoji: '🇭🇰'
  },
  {
    keywords: ['🇹🇼', 'TW', '台湾', '台灣', '臺灣', '台', 'CHT', 'HINET', 'Taiwan'],
    subKeywords: ['台北', '台中', '新北', '彰化', '中正'],
    standardName: { zh: '台湾', en: 'TW' },
    emoji: '🇹🇼'
  },
  {
    keywords: ['🇲🇴', 'MO', '澳门', '澳門', 'CTM', 'MAC', 'Macao', 'Macau'],
    subKeywords: [],
    standardName: { zh: '澳门', en: 'MO' },
    emoji: '🇲🇴'
  },
  {
    keywords: ['🇸🇬', 'SG', '新加坡', '狮城', '獅城', '沪新', '京新', '泉新', '穗新', '深新', '杭新', '广新', '廣新', '滬新', 'Singapore'],
    subKeywords: ['滨海', 'NorthWest'],
    standardName: { zh: '新加坡', en: 'SG' },
    emoji: '🇸🇬'
  },
  {
    keywords: ['🇯🇵', 'JP', '日本', '京日', '苏日', '沪日', '广日', '上日', '穗日', '川日', '中日', '泉日', '杭日', '深日', 'Japan'],
    subKeywords: ['东京', '大阪', '名古屋', '埼玉', 'Tokyo', 'Osaka', 'Nagoya'],
    standardName: { zh: '日本', en: 'JP' },
    emoji: '🇯🇵'
  },
  {
    keywords: ['🇺🇸', 'US', '美国', '美國', '京美', '广美', 'USA', 'America', 'United States', 'UnitedStates'],
    subKeywords: ['硅谷', '旧金山', '洛杉矶', '西雅图', '芝加哥', '波士顿', '纽约', '凤凰城', '圣何塞', '哥伦布', 'Virginia', 'California'],
    standardName: { zh: '美国', en: 'US' },
    emoji: '🇺🇸'
  },
  {
    keywords: ['🇨🇭', 'CH', '瑞士', 'Swiss'],
    subKeywords: ['蘇黎世', '苏黎世', '日内瓦', '瑞士银行', '瑞士信贷', '瑞士國際航空'],
    standardName: { zh: '瑞士', en: 'CH' },
    emoji: '🇨🇭'
  },
  {
    keywords: ['🇩🇪', 'DE', '德国', '德國'],
    subKeywords: ['法兰克福', '法蘭克福', '德意志銀行', '德意志銀行股份有限公司', '德意志銀行集團', '德意志銀行股份公司'],
    standardName: { zh: '德国', en: 'DE' },
    emoji: '🇩🇪'
  },
  {
    keywords: ['🇰🇷', 'KR', '韩国', '韓國'],
    subKeywords: ['首尔', '首爾', '釜山', '韓國電信', '韓國電信股份有限公司', 'SK電訊', 'SK電訊股份有限公司'],
    standardName: { zh: '韩国', en: 'KR' },
    emoji: '🇰🇷'
  },
  {
    keywords: ['🇰🇵', 'KP', '朝鲜', '北韓'],
    subKeywords: ['平壤', '平壤市'],
    standardName: { zh: '朝鲜', en: 'KP' },
    emoji: '🇰🇵'
  },
  {
    keywords: ['🇷🇺', 'RU', '俄罗斯', '俄羅斯', '毛子', '俄国', '俄國', '俄羅斯聯邦'],
    subKeywords: ['莫斯科', '聖彼得堡'],
    standardName: { zh: '俄罗斯', en: 'RU' },
    emoji: '🇷🇺'
  },
  {
    keywords: ['🇦🇷', 'AR', '阿根廷', 'Argentina'],
    subKeywords: [],
    standardName: { zh: '阿根廷', en: 'AR' },
    emoji: '🇦🇷'
  },
  {
    keywords: ['🇦🇺', 'AU', '澳大利亚', '澳洲', 'Australia', 'Sydney'],
    subKeywords: ['墨尔本', '悉尼', '斯卡伯勒'],
    standardName: { zh: '澳大利亚', en: 'AU' },
    emoji: '🇦🇺'
  },
  {
    keywords: ['🇧🇪', 'BE', '比利时', '比利時', 'Belgium'],
    subKeywords: [],
    standardName: { zh: '比利时', en: 'BE' },
    emoji: '🇧🇪'
  },
  {
    keywords: ['🇧🇷', 'BR', '巴西', 'GBR', 'Brazil'],
    subKeywords: ['巴西利亚', '圣保罗', '维涅杜'],
    standardName: { zh: '巴西', en: 'BR' },
    emoji: '🇧🇷'
  },
  {
    keywords: ['🇧🇬', 'BG', '保加利亚', '保加利亞', 'Bulgaria'],
    subKeywords: [],
    standardName: { zh: '保加利亚', en: 'BG' },
    emoji: '🇧🇬'
  },
  {
    keywords: ['🇮🇳', 'IN', '印度', 'IND', 'India', 'INDIA'],
    subKeywords: ['孟买', 'Mumbai', 'Bombay'],
    standardName: { zh: '印度', en: 'IN' },
    emoji: '🇮🇳'
  },
  {
    keywords: ['🇮🇩', 'ID', '印尼', '印度尼西亚', 'IDN', 'Indonesia'],
    subKeywords: ['雅加达', 'Jakarta'],
    standardName: { zh: '印尼', en: 'ID' },
    emoji: '🇮🇩'
  },
  {
    keywords: ['🇬🇧', 'GB', '英国', '英國', 'UK', 'England', 'United Kingdom', 'Britain'],
    subKeywords: ['伦敦'],
    standardName: { zh: '英国', en: 'GB' },
    emoji: '🇬🇧'
  },
  {
    keywords: ['🇫🇷', 'FR', '法国', '法國', '巴黎', 'France'],
    subKeywords: ['巴黎', 'France'],
    standardName: { zh: '法国', en: 'FR' },
    emoji: '🇫🇷'
  },
  {
    keywords: ['🇩🇰', 'DK', '丹麦', '丹麥', 'DNK', 'Denmark'],
    subKeywords: [],
    standardName: { zh: '丹麦', en: 'DK' },
    emoji: '🇩🇰'
  },
  {
    keywords: ['🇳🇴', 'NO', '挪威', 'Norway'],
    subKeywords: [],
    standardName: { zh: '挪威', en: 'NO' },
    emoji: '🇳🇴'
  },
  {
    keywords: ['🇮🇹', 'IT', '意大利', '義大利', 'Italy'],
    subKeywords: ['米兰', '米蘭', '罗马', '羅馬'],
    standardName: { zh: '意大利', en: 'IT' },
    emoji: '🇮🇹'
  },
  {
    keywords: ['🇻🇦', 'VA', '梵蒂冈', '梵蒂岡', 'Vatican City'],
    subKeywords: [],
    standardName: { zh: '梵蒂冈', en: 'VA' },
    emoji: '🇻🇦'
  },
  {
    keywords: ['🇨🇦', 'CA', '加拿大', '楓葉', '枫叶', 'CAN', 'Canada', 'CANADA'],
    subKeywords: ['多伦多', '温哥华', '渥太华', '蒙特利尔', '滑铁卢', 'Waterloo'],
    standardName: { zh: '加拿大', en: 'CA' },
    emoji: '🇨🇦'
  },
  {
    keywords: ['🇲🇾', 'MY', '马来西亚', '马来', '馬來', 'Malaysia', 'MALAYSIA', 'KualaLumpur'],
    subKeywords: ['吉隆坡', 'KualaLumpur', 'Kuala Lumpur'],
    standardName: { zh: '马来西亚', en: 'MY' },
    emoji: '🇲🇾'
  },
  {
    keywords: ['🇲🇻', 'MV', '马尔代夫', '馬爾代夫', 'Maldives'],
    subKeywords: [],
    standardName: { zh: '马尔代夫', en: 'MV' },
    emoji: '🇲🇻'
  },
  {
    keywords: ['🇹🇷', 'TR', '土耳其', 'TUR', 'Turkey'],
    subKeywords: ['伊斯坦布尔', '安卡拉', '安塔利亚'],
    standardName: { zh: '土耳其', en: 'TR' },
    emoji: '🇹🇷'
  },
  {
    keywords: ['🇵🇭', 'PH', '菲律宾', '菲律賓', 'Philippines'],
    subKeywords: ['马尼拉', '宿务', '达沃'],
    standardName: { zh: '菲律宾', en: 'PH' },
    emoji: '🇵🇭'
  },
  {
    keywords: ['🇹🇭', 'TH', '泰国', '泰國', 'Thailand'],
    subKeywords: ['曼谷', '清迈', '普吉岛', '拉塔纳科辛岛'],
    standardName: { zh: '泰国', en: 'TH' },
    emoji: '🇹🇭'
  },
  {
    keywords: ['🇻🇳', 'VN', '越南', 'Vietnam'],
    subKeywords: ['胡志明市', '河内'],
    standardName: { zh: '越南', en: 'VN' },
    emoji: '🇻🇳'
  },
  {
    keywords: ['🇰🇭', 'KH', '柬埔寨', 'Cambodia'],
    subKeywords: ['金边', '暹粒'],
    standardName: { zh: '柬埔寨', en: 'KH' },
    emoji: '🇰🇭'
  },
  {
    keywords: ['🇱🇦', 'LA', '老挝', 'Laos'],
    subKeywords: ['万象', '琅勃拉邦'],
    standardName: { zh: '老挝', en: 'LA' },
    emoji: '🇱🇦'
  },
  {
    keywords: ['🇧🇩', 'BD', '孟加拉', 'Bengal'],
    subKeywords: ['达卡', '吉大港'],
    standardName: { zh: '孟加拉', en: 'BD' },
    emoji: '🇧🇩'
  },
  {
    keywords: ['🇲🇲', 'MM', '缅甸', '緬甸', 'Myanmar'],
    subKeywords: ['仰光', '曼德勒', '内比都'],
    standardName: { zh: '缅甸', en: 'MM' },
    emoji: '🇲🇲'
  },
  {
    keywords: ['🇱🇧', 'LB', '黎巴嫩', 'Lebanon'],
    subKeywords: ['贝鲁特'],
    standardName: { zh: '黎巴嫩', en: 'LB' },
    emoji: '🇱🇧'
  },
  {
    keywords: ['🇺🇦', 'UA', '乌克兰', '烏克蘭', 'Ukraine'],
    subKeywords: ['基辅', '敖德萨'],
    standardName: { zh: '乌克兰', en: 'UA' },
    emoji: '🇺🇦'
  },
  {
    keywords: ['🇭🇺', 'HU', '匈牙利', 'Hungary'],
    subKeywords: [],
    standardName: { zh: '匈牙利', en: 'HU' },
    emoji: '🇭🇺'
  },
  {
    keywords: ['🇸🇪', 'SE', '瑞典', 'Sweden'],
    subKeywords: ['斯德哥尔摩'],
    standardName: { zh: '瑞典', en: 'SE' },
    emoji: '🇸🇪'
  },
  {
    keywords: ['🇱🇺', 'LU', '卢森堡', 'Luxembourg'],
    subKeywords: [],
    standardName: { zh: '卢森堡', en: 'LU' },
    emoji: '🇱🇺'
  },
  {
    keywords: ['🇦🇹', 'AT', '奥地利', '奧地利', 'Austria'],
    subKeywords: ['维也纳'],
    standardName: { zh: '奥地利', en: 'AT' },
    emoji: '🇦🇹'
  },
  {
    keywords: ['🇨🇿', 'CZ', '捷克', 'Czechia'],
    subKeywords: ['布拉格'],
    standardName: { zh: '捷克', en: 'CZ' },
    emoji: '🇨🇿'
  },
  {
    keywords: ['🇬🇷', 'GR', '希腊', '希臘', 'Greece'],
    subKeywords: ['雅典', '塞萨洛尼基'],
    standardName: { zh: '希腊', en: 'GR' },
    emoji: '🇬🇷'
  },
  {
    keywords: ['🇮🇸', 'IS', '冰岛', '冰島', 'ISL', 'Iceland'],
    subKeywords: ['雷克雅未克'],
    standardName: { zh: '冰岛', en: 'IS' },
    emoji: '🇮🇸'
  },
  {
    keywords: ['🇳🇿', 'NZ', '新西兰', '新西蘭', 'New Zealand'],
    subKeywords: ['奥克兰', '惠灵顿', '基督城'],
    standardName: { zh: '新西兰', en: 'NZ' },
    emoji: '🇳🇿'
  },
  {
    keywords: ['🇮🇪', 'IE', '爱尔兰', '愛爾蘭', 'Ireland'],
    subKeywords: ['都柏林'],
    standardName: { zh: '爱尔兰', en: 'IE' },
    emoji: '🇮🇪'
  },
  {
    keywords: ['🇮🇲', 'IM', '马恩岛', '馬恩島', 'Mannin', 'Isle of Man'],
    subKeywords: [],
    standardName: { zh: '马恩岛', en: 'IM' },
    emoji: '🇮🇲'
  },
  {
    keywords: ['🇱🇹', 'LT', '立陶宛', 'Lithuania'],
    subKeywords: ['维尔纽斯'],
    standardName: { zh: '立陶宛', en: 'LT' },
    emoji: '🇱🇹'
  },
  {
    keywords: ['🇫🇮', 'FI', '芬兰', '芬蘭', 'Finland'],
    subKeywords: ['赫尔辛基'],
    standardName: { zh: '芬兰', en: 'FI' },
    emoji: '🇫🇮'
  },
  {
    keywords: ['🇺🇾', 'UY', '乌拉圭', '烏拉圭', 'Uruguay'],
    subKeywords: ['蒙得维的亚'],
    standardName: { zh: '乌拉圭', en: 'UY' },
    emoji: '🇺🇾'
  },
  {
    keywords: ['🇵🇾', 'PY', '巴拉圭', 'Paraguay'],
    subKeywords: ['亚松森'],
    standardName: { zh: '巴拉圭', en: 'PY' },
    emoji: '🇵🇾'
  },
  {
    keywords: ['🇯🇲', 'JM', '牙买加', '牙買加', 'Jamaica'],
    subKeywords: ['金斯敦'],
    standardName: { zh: '牙买加', en: 'JM' },
    emoji: '🇯🇲'
  },
  {
    keywords: ['🇸🇷', 'SR', '苏里南', '蘇里南', 'Suriname'],
    subKeywords: ['帕拉马里博'],
    standardName: { zh: '苏里南', en: 'SR' },
    emoji: '🇸🇷'
  },
  {
    keywords: ['🇨🇼', 'CW', '库拉索', '庫拉索', 'Curaçao'],
    subKeywords: [],
    standardName: { zh: '库拉索', en: 'CW' },
    emoji: '🇨🇼'
  },
  {
    keywords: ['🇨🇴', 'CO', '哥伦比亚', 'Colombia'],
    subKeywords: [],
    standardName: { zh: '哥伦比亚', en: 'CO' },
    emoji: '🇨🇴'
  },
  {
    keywords: ['🇪🇨', 'EC', '厄瓜多尔', 'Ecuador'],
    subKeywords: [],
    standardName: { zh: '厄瓜多尔', en: 'EC' },
    emoji: '🇪🇨'
  },
  {
    keywords: ['🇪🇸', 'ES', '西班牙', 'Spain'],
    subKeywords: [],
    standardName: { zh: '西班牙', en: 'ES' },
    emoji: '🇪🇸'
  },
  {
    keywords: ['🇵🇹', 'PT', '葡萄牙', 'Portugal'],
    subKeywords: [],
    standardName: { zh: '葡萄牙', en: 'PT' },
    emoji: '🇵🇹'
  },
  {
    keywords: ['🇮🇱', 'IL', '以色列', 'Israel'],
    subKeywords: [],
    standardName: { zh: '以色列', en: 'IL' },
    emoji: '🇮🇱'
  },
  {
    keywords: ['🇸🇦', 'SA', '沙特', 'Saudi', 'Saudi Arabia'],
    subKeywords: ['利雅得', '吉达'],
    standardName: { zh: '沙特', en: 'SA' },
    emoji: '🇸🇦'
  },
  {
    keywords: ['🇲🇳', 'MN', '蒙古', 'Mongolia'],
    subKeywords: ['乌兰巴托'],
    standardName: { zh: '蒙古', en: 'MN' },
    emoji: '🇲🇳'
  },
  {
    keywords: ['🇦🇪', 'AE', '阿联酋', 'United Arab Emirates'],
    subKeywords: ['阿布扎比', '迪拜', 'Dubai'],
    standardName: { zh: '阿联酋', en: 'AE' },
    emoji: '🇦🇪'
  },
  {
    keywords: ['🇦🇿', 'AZ', '阿塞拜疆', 'Azerbaijan'],
    subKeywords: [],
    standardName: { zh: '阿塞拜疆', en: 'AZ' },
    emoji: '🇦🇿'
  },
  {
    keywords: ['🇦🇲', 'AM', '亚美尼亚', '亞美尼亞', 'Armenia'],
    subKeywords: [],
    standardName: { zh: '亚美尼亚', en: 'AM' },
    emoji: '🇦🇲'
  },
  {
    keywords: ['🇰🇿', 'KZ', '哈萨克斯坦', '哈薩克斯坦', 'Kazakhstan'],
    subKeywords: [],
    standardName: { zh: '哈萨克斯坦', en: 'KZ' },
    emoji: '🇰🇿'
  },
  {
    keywords: ['🇰🇬', 'KG', '吉尔吉斯坦', '吉尔吉斯斯坦', 'Kyrghyzstan'],
    subKeywords: [],
    standardName: { zh: '吉尔吉斯坦', en: 'KG' },
    emoji: '🇰🇬'
  },
  {
    keywords: ['🇺🇿', 'UZ', '乌兹别克斯坦', '烏茲別克斯坦', 'Uzbekistan'],
    subKeywords: [],
    standardName: { zh: '乌兹别克斯坦', en: 'UZ' },
    emoji: '🇺🇿'
  },
  {
    keywords: ['🇨🇱', 'CL', '智利', 'Chile', 'CHILE'],
    subKeywords: [],
    standardName: { zh: '智利', en: 'CL' },
    emoji: '🇨🇱'
  },
  {
    keywords: ['🇵🇪', 'PE', '秘鲁', '祕魯', 'Peru'],
    subKeywords: [],
    standardName: { zh: '秘鲁', en: 'PE' },
    emoji: '🇵🇪'
  },
  {
    keywords: ['🇨🇺', 'CU', '古巴', 'Cuba'],
    subKeywords: [],
    standardName: { zh: '古巴', en: 'CU' },
    emoji: '🇨🇺'
  },
  {
    keywords: ['🇧🇹', 'BT', '不丹', 'Bhutan'],
    subKeywords: [],
    standardName: { zh: '不丹', en: 'BT' },
    emoji: '🇧🇹'
  },
  {
    keywords: ['🇦🇩', 'AD', '安道尔', 'Andorra'],
    subKeywords: [],
    standardName: { zh: '安道尔', en: 'AD' },
    emoji: '🇦🇩'
  },
  {
    keywords: ['🇲🇹', 'MT', '马耳他', 'Malta'],
    subKeywords: [],
    standardName: { zh: '马耳他', en: 'MT' },
    emoji: '🇲🇹'
  },
  {
    keywords: ['🇲🇨', 'MC', '摩纳哥', '摩納哥', 'Monaco'],
    subKeywords: [],
    standardName: { zh: '摩纳哥', en: 'MC' },
    emoji: '🇲🇨'
  },
  {
    keywords: ['🇷🇴', 'RO', '罗马尼亚', 'Rumania'],
    subKeywords: [],
    standardName: { zh: '罗马尼亚', en: 'RO' },
    emoji: '🇷🇴'
  },
  {
    keywords: ['🇭🇷', 'HR', '克罗地亚', '克羅地亞', 'Croatia'],
    subKeywords: [],
    standardName: { zh: '克罗地亚', en: 'HR' },
    emoji: '🇭🇷'
  },
  {
    keywords: ['🇲🇰', 'MK', '北马其顿', '北馬其頓', 'North Macedonia'],
    subKeywords: [],
    standardName: { zh: '北马其顿', en: 'MK' },
    emoji: '🇲🇰'
  },
  {
    keywords: ['🇷🇸', 'RS', '塞尔维亚', '塞爾維亞', 'Seville', 'Sevilla'],
    subKeywords: [],
    standardName: { zh: '塞尔维亚', en: 'RS' },
    emoji: '🇷🇸'
  },
  {
    keywords: ['🇨🇾', 'CY', '塞浦路斯', 'Cyprus'],
    subKeywords: [],
    standardName: { zh: '塞浦路斯', en: 'CY' },
    emoji: '🇨🇾'
  },
  {
    keywords: ['🇱🇻', 'LV', '拉脱维亚', 'Latvia', 'Latvija'],
    subKeywords: [],
    standardName: { zh: '拉脱维亚', en: 'LV' },
    emoji: '🇱🇻'
  },
  {
    keywords: ['🇲🇩', 'MD', '摩尔多瓦', '摩爾多瓦', 'Moldova'],
    subKeywords: [],
    standardName: { zh: '摩尔多瓦', en: 'MD' },
    emoji: '🇲🇩'
  },
  {
    keywords: ['🇸🇰', 'SK', '斯洛伐克', 'Slovakia'],
    subKeywords: [],
    standardName: { zh: '斯洛伐克', en: 'SK' },
    emoji: '🇸🇰'
  },
  {
    keywords: ['🇪🇪', 'EE', '爱沙尼亚', 'Estonia'],
    subKeywords: [],
    standardName: { zh: '爱沙尼亚', en: 'EE' },
    emoji: '🇪🇪'
  },
  {
    keywords: ['🇧🇾', 'BY', '白俄罗斯', '白俄羅斯', 'White Russia', 'Republic of Belarus', 'Belarus'],
    subKeywords: [],
    standardName: { zh: '白俄罗斯', en: 'BY' },
    emoji: '🇧🇾'
  },
  {
    keywords: ['🇧🇳', 'BN', '文莱', '汶萊', 'BRN', 'Negara Brunei Darussalam'],
    subKeywords: [],
    standardName: { zh: '文莱', en: 'BN' },
    emoji: '🇧🇳'
  },
  {
    keywords: ['🇬🇺', 'GU', '关岛', '關島', 'Guam'],
    subKeywords: [],
    standardName: { zh: '关岛', en: 'GU' },
    emoji: '🇬🇺'
  },
  {
    keywords: ['🇫🇯', 'FJ', '斐济', '斐濟', 'Fiji'],
    subKeywords: [],
    standardName: { zh: '斐济', en: 'FJ' },
    emoji: '🇫🇯'
  },
  {
    keywords: ['🇯🇴', 'JO', '约旦', '約旦', 'Jordan'],
    subKeywords: [],
    standardName: { zh: '约旦', en: 'JO' },
    emoji: '🇯🇴'
  },
  {
    keywords: ['🇬🇪', 'GE', '格鲁吉亚', '格魯吉亞', 'Georgia'],
    subKeywords: [],
    standardName: { zh: '格鲁吉亚', en: 'GE' },
    emoji: '🇬🇪'
  },
  {
    keywords: ['🇬🇮', 'GI', '直布罗陀', '直布羅陀', 'Gibraltar'],
    subKeywords: [],
    standardName: { zh: '直布罗陀', en: 'GI' },
    emoji: '🇬🇮'
  },
  {
    keywords: ['🇸🇲', 'SM', '圣马力诺', '聖馬利諾', 'San Marino'],
    subKeywords: [],
    standardName: { zh: '圣马力诺', en: 'SM' },
    emoji: '🇸🇲'
  },
  {
    keywords: ['🇳🇵', 'NP', '尼泊尔', 'Nepal'],
    subKeywords: [],
    standardName: { zh: '尼泊尔', en: 'NP' },
    emoji: '🇳🇵'
  },
  {
    keywords: ['🇫🇴', 'FO', '法罗群岛', '法羅群島', 'Faroe Islands'],
    subKeywords: [],
    standardName: { zh: '法罗群岛', en: 'FO' },
    emoji: '🇫🇴'
  },
  {
    keywords: ['🇦🇽', 'AX', '奥兰群岛', '奧蘭群島', 'Åland'],
    subKeywords: [],
    standardName: { zh: '奥兰群岛', en: 'AX' },
    emoji: '🇦🇽'
  },
  {
    keywords: ['🇸🇮', 'SI', '斯洛文尼亚', '斯洛文尼亞', 'Slovenia'],
    subKeywords: [],
    standardName: { zh: '斯洛文尼亚', en: 'SI' },
    emoji: '🇸🇮'
  },
  {
    keywords: ['🇦🇱', 'AL', '阿尔巴尼亚', '阿爾巴尼亞', 'Albania'],
    subKeywords: [],
    standardName: { zh: '阿尔巴尼亚', en: 'AL' },
    emoji: '🇦🇱'
  },
  {
    keywords: ['🇹🇱', 'TL', '东帝汶', '東帝汶', 'East Timor'],
    subKeywords: [],
    standardName: { zh: '东帝汶', en: 'TL' },
    emoji: '🇹🇱'
  },
  {
    keywords: ['🇵🇦', 'PA', '巴拿马', '巴拿馬', 'Panama'],
    subKeywords: [],
    standardName: { zh: '巴拿马', en: 'PA' },
    emoji: '🇵🇦'
  },
  {
    keywords: ['🇧🇲', 'BM', '百慕大', 'Bermuda'],
    subKeywords: [],
    standardName: { zh: '百慕大', en: 'BM' },
    emoji: '🇧🇲'
  },
  {
    keywords: ['🇬🇱', 'GL', '格陵兰', '格陵蘭', 'Greenland'],
    subKeywords: [],
    standardName: { zh: '格陵兰', en: 'GL' },
    emoji: '🇬🇱'
  },
  {
    keywords: ['🇨🇷', 'CR', '哥斯达黎加', 'Costa Rica'],
    subKeywords: [],
    standardName: { zh: '哥斯达黎加', en: 'CR' },
    emoji: '🇨🇷'
  },
  {
    keywords: ['🇻🇬', 'VG', '英属维尔', 'British Virgin Islands'],
    subKeywords: [],
    standardName: { zh: '英属维尔', en: 'VG' },
    emoji: '🇻🇬'
  },
  {
    keywords: ['🇻🇮', 'VI', '美属维尔京', 'United States Virgin Islands'],
    subKeywords: [],
    standardName: { zh: '美属维尔京', en: 'VI' },
    emoji: '🇻🇮'
  },
  {
    keywords: ['🇲🇽', 'MX', '墨西哥', 'MEX', 'MEXICO'],
    subKeywords: [],
    standardName: { zh: '墨西哥', en: 'MX' },
    emoji: '🇲🇽'
  },
  {
    keywords: ['🇲🇪', 'ME', '黑山', 'Montenegro'],
    subKeywords: [],
    standardName: { zh: '黑山', en: 'ME' },
    emoji: '🇲🇪'
  },
  {
    keywords: ['🇳🇱', 'NL', '荷兰', '荷蘭', 'Netherlands'],
    subKeywords: ['尼德蘭', '阿姆斯特丹', 'Amsterdam'],
    standardName: { zh: '荷兰', en: 'NL' },
    emoji: '🇳🇱'
  },
  {
    keywords: ['🇵🇱', 'PL', '波兰', '波蘭', 'POL', 'Poland'],
    subKeywords: ['华沙', '克拉科夫'],
    standardName: { zh: '波兰', en: 'PL' },
    emoji: '🇵🇱'
  },
  {
    keywords: ['🇩🇿', 'DZ', '阿尔及利亚', 'Algeria'],
    subKeywords: [],
    standardName: { zh: '阿尔及利亚', en: 'DZ' },
    emoji: '🇩🇿'
  },
  {
    keywords: ['🇧🇦', 'BA', '波黑共和国', '波黑', 'Bosnia and Herzegovina'],
    subKeywords: [],
    standardName: { zh: '波黑共和国', en: 'BA' },
    emoji: '🇧🇦'
  },
  {
    keywords: ['🇱🇮', 'LI', '列支敦士登', 'Liechtenstein'],
    subKeywords: [],
    standardName: { zh: '列支敦士登', en: 'LI' },
    emoji: '🇱🇮'
  },
  {
    keywords: ['🇷🇪', 'RE', '留尼汪', '留尼旺', 'Réunion', 'Reunion'],
    subKeywords: [],
    standardName: { zh: '留尼汪', en: 'RE' },
    emoji: '🇷🇪'
  },
  {
    keywords: ['🇿🇦', 'ZA', '南非', 'South Africa'],
    subKeywords: ['约翰内斯堡', 'Johannesburg'],
    standardName: { zh: '南非', en: 'ZA' },
    emoji: '🇿🇦'
  },
  {
    keywords: ['🇪🇬', 'EG', '埃及', 'Egypt'],
    subKeywords: [],
    standardName: { zh: '埃及', en: 'EG' },
    emoji: '🇪🇬'
  },
  {
    keywords: ['🇬🇭', 'GH', '加纳', 'Ghana'],
    subKeywords: [],
    standardName: { zh: '加纳', en: 'GH' },
    emoji: '🇬🇭'
  },
  {
    keywords: ['🇲🇱', 'ML', '马里', '馬里', 'Mali'],
    subKeywords: [],
    standardName: { zh: '马里', en: 'ML' },
    emoji: '🇲🇱'
  },
  {
    keywords: ['🇲🇦', 'MA', '摩洛哥', 'Morocco'],
    subKeywords: [],
    standardName: { zh: '摩洛哥', en: 'MA' },
    emoji: '🇲🇦'
  },
  {
    keywords: ['🇹🇳', 'TN', '突尼斯', 'Tunisia'],
    subKeywords: [],
    standardName: { zh: '突尼斯', en: 'TN' },
    emoji: '🇹🇳'
  },
  {
    keywords: ['🇱🇾', 'LY', '利比亚', 'Libya'],
    subKeywords: [],
    standardName: { zh: '利比亚', en: 'LY' },
    emoji: '🇱🇾'
  },
  {
    keywords: ['🇰🇪', 'KE', '肯尼亚', '肯尼亞', 'Kenya'],
    subKeywords: [],
    standardName: { zh: '肯尼亚', en: 'KE' },
    emoji: '🇰🇪'
  },
  {
    keywords: ['🇷🇼', 'RW', '卢旺达', '盧旺達', 'Rwanda'],
    subKeywords: [],
    standardName: { zh: '卢旺达', en: 'RW' },
    emoji: '🇷🇼'
  },
  {
    keywords: ['🇨🇻', 'CV', '佛得角', '維德角', 'Cape Verde'],
    subKeywords: [],
    standardName: { zh: '佛得角', en: 'CV' },
    emoji: '🇨🇻'
  },
  {
    keywords: ['🇦🇴', 'AO', '安哥拉', 'Angola'],
    subKeywords: [],
    standardName: { zh: '安哥拉', en: 'AO' },
    emoji: '🇦🇴'
  },
  {
    keywords: ['🇳🇬', 'NG', '尼日利亚', '尼日利亞', 'Nigeria'],
    subKeywords: ['拉各斯', 'Lagos'],
    standardName: { zh: '尼日利亚', en: 'NG' },
    emoji: '🇳🇬'
  },
  {
    keywords: ['🇲🇺', 'MU', '毛里求斯', 'Mauritius'],
    subKeywords: [],
    standardName: { zh: '毛里求斯', en: 'MU' },
    emoji: '🇲🇺'
  },
  {
    keywords: ['🇴🇲', 'OM', '阿曼', 'Oman'],
    subKeywords: [],
    standardName: { zh: '阿曼', en: 'OM' },
    emoji: '🇴🇲'
  },
  {
    keywords: ['🇧🇭', 'BH', '巴林', 'Bahrain'],
    subKeywords: [],
    standardName: { zh: '巴林', en: 'BH' },
    emoji: '🇧🇭'
  },
  {
    keywords: ['🇮🇶', 'IQ', '伊拉克', 'Iraq'],
    subKeywords: [],
    standardName: { zh: '伊拉克', en: 'IQ' },
    emoji: '🇮🇶'
  },
  {
    keywords: ['🇮🇷', 'IR', '伊朗', 'Iran'],
    subKeywords: [],
    standardName: { zh: '伊朗', en: 'IR' },
    emoji: '🇮🇷'
  },
  {
    keywords: ['🇦🇫', 'AF', '阿富汗', 'Afghanistan'],
    subKeywords: [],
    standardName: { zh: '阿富汗', en: 'AF' },
    emoji: '🇦🇫'
  },
  {
    keywords: ['🇵🇰', 'PK', '巴基斯坦', 'Pakistan', 'PAKISTAN'],
    subKeywords: [],
    standardName: { zh: '巴基斯坦', en: 'PK' },
    emoji: '🇵🇰'
  },
  {
    keywords: ['🇶🇦', 'QA', '卡塔尔', '卡塔爾', 'Qatar'],
    subKeywords: [],
    standardName: { zh: '卡塔尔', en: 'QA' },
    emoji: '🇶🇦'
  },
  {
    keywords: ['🇸🇾', 'SY', '叙利亚', '敘利亞', 'Syria'],
    subKeywords: [],
    standardName: { zh: '叙利亚', en: 'SY' },
    emoji: '🇸🇾'
  },
  {
    keywords: ['🇱🇰', 'LK', '斯里兰卡', '斯里蘭卡', 'Sri Lanka'],
    subKeywords: [],
    standardName: { zh: '斯里兰卡', en: 'LK' },
    emoji: '🇱🇰'
  },
  {
    keywords: ['🇻🇪', 'VE', '委内瑞拉', 'Venezuela'],
    subKeywords: [],
    standardName: { zh: '委内瑞拉', en: 'VE' },
    emoji: '🇻🇪'
  },
  {
    keywords: ['🇬🇹', 'GT', '危地马拉', 'Guatemala'],
    subKeywords: [],
    standardName: { zh: '危地马拉', en: 'GT' },
    emoji: '🇬🇹'
  },
  {
    keywords: ['🇵🇷', 'PR', '波多黎各', 'Puerto Rico'],
    subKeywords: [],
    standardName: { zh: '波多黎各', en: 'PR' },
    emoji: '🇵🇷'
  },
  {
    keywords: ['🇰🇾', 'KY', '开曼群岛', '開曼群島', '盖曼群岛', '凯门群岛', 'Cayman Islands'],
    subKeywords: [],
    standardName: { zh: '开曼群岛', en: 'KY' },
    emoji: '🇰🇾'
  },
  {
    keywords: ['🇸🇯', 'SJ', '斯瓦尔巴', '扬马延', 'Svalbard', 'Mayen'],
    subKeywords: [],
    standardName: { zh: '斯瓦尔巴', en: 'SJ' },
    emoji: '🇸🇯'
  },
  {
    keywords: ['🇭🇳', 'HN', '洪都拉斯', 'Honduras'],
    subKeywords: [],
    standardName: { zh: '洪都拉斯', en: 'HN' },
    emoji: '🇭🇳'
  },
  {
    keywords: ['🇳🇮', 'NI', '尼加拉瓜', 'Nicaragua'],
    subKeywords: [],
    standardName: { zh: '尼加拉瓜', en: 'NI' },
    emoji: '🇳🇮'
  },
  {
    keywords: ['🇦🇶', 'AQ', '南极', '南極', 'Antarctica'],
    subKeywords: [],
    standardName: { zh: '南极', en: 'AQ' },
    emoji: '🇦🇶'
  },
  {
    keywords: ['🇨🇳', 'CN', '中国', '中國', '回国', 'back', 'China'],
    subKeywords: ['江苏', '北京', '上海', '广州', '深圳', '杭州', '徐州', '青岛', '宁波', '镇江', '沈阳', '济南'],
    standardName: { zh: '中国', en: 'CN' },
    emoji: '🇨🇳'
  }
  // 添加更多的国家关键词和对应的 Emoji
]
