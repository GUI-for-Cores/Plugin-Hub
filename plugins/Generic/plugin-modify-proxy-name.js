// 该插件可实现三个功能：
// 一、在节点名称前加上对应的国家地区的 Emoji。
//    - EnableAddEmoji = 0 表示关闭该功能。
//    - EnableAddEmoji = 1 表示开启，默认值为 1。
// 二、移除节点名称中的一些关键词。
//    - EnableRemoveKeywords = 0 表示关闭该功能，默认值为 0。
//    - EnableRemoveKeywords = 1 表示开启。
//    - 使用正则表达式 RemoveKeywords 进行匹配。
//      正则表达式 /关键词1|关键词2|关键词3/g 将会匹配 proxy name 中的 关键词1、关键词2 和 关键词3，
//      并将其替换为一个空字符串。你可以根据自己的需求修改正则表达式，添加或删除需要匹配的关键词。
// 三、对节点名称进行标号。
//    - EnableIndexProxyName = 0 表示关闭该功能。
//    - EnableIndexProxyName = 1 对所有节点按顺序标号。
//    - EnableIndexProxyName = 2 对相同的节点名称进行标号，默认值为 2。

// 移除关键词的正则表达式，匹配的关键词将被移除。
let RemoveKeywords = new RegExp(Plugin.RemoveKeywords, 'g')
// 正则表达式 "关键词1|关键词2|关键词3" 将会匹配 proxy name 中的 "关键词1" "关键词2" 和 "关键词3"，
// 并将其替换为一个空字符串。你可以根据自己的需求修改正则表达式，添加或删除需要匹配的关键词。

// 使用正则表达式来表示国家地区关键词
const KeywordsToEmoji = {
  '🇭🇰|HK|香港|沪港|呼港|中港|HKT|HKBN|HGC|WTT|CMI|穗港|广港|京港|Hongkong|Hong Kong|HongKong|HONG KONG': '🇭🇰',
  '🇹🇼|TW|台湾|台灣|臺灣|台北|台中|新北|彰化|台|CHT|HINET|Taiwan|TAIWAN': '🇹🇼',
  '🇲🇴|MO|澳门|澳門|CTM|MAC|Macao|Macau|MO': '🇲🇴',
  '🇸🇬|SG|新加坡|狮城|獅城|沪新|京新|泉新|穗新|深新|杭新|广新|廣新|滬新|Singapore|SINGAPORE': '🇸🇬',
  '🇯🇵|JP|日本|东京|大阪|埼玉|京日|苏日|沪日|广日|上日|穗日|川日|中日|泉日|杭日|深日|Japan|JAPAN|Osaka|Tokyo': '🇯🇵',
  '🇺🇸|US|美国|美國|京美|硅谷|凤凰城|洛杉矶|西雅图|圣何塞|芝加哥|哥伦布|纽约|广美|USA|America|United States|Virginia|': '🇺🇸',
  '🇰🇷|KR|韩国|韓國|首尔|韩|韓|春川|KOR|Kr|Korea': '🇰🇷',
  '🇰🇵|KP|朝鲜|North Korea': '🇰🇵',
  '🇷🇺|RU|俄罗斯|俄羅斯|毛子|俄国|RUS|Russia': '🇷🇺',
  '🇮🇳|IN|印度|孟买|IND|India|INDIA|Mumbai': '🇮🇳',
  '🇮🇩|ID|印尼|印度尼西亚|雅加达|IDN|Indonesia|Jakarta': '🇮🇩',
  '🇬🇧|GB|英国|英國|伦敦|UK|England|United Kingdom|Britain': '🇬🇧',
  '🇩🇪|DE|德国|德國|法兰克福|🇩🇪|German|GERMAN': '🇩🇪',
  '🇫🇷|FR|法国|法國|巴黎|France': '🇫🇷',
  '🇩🇰|DK|丹麦|丹麥|DNK|Denmark': '🇩🇰',
  '🇳🇴|NO|挪威|Norway': '🇳🇴',
  '🇮🇹|IT|意大利|義大利|米兰|Italy|Nachash': '🇮🇹',
  '🇻🇦|VA|梵蒂冈|梵蒂岡|Vatican City': '🇻🇦',
  '🇧🇪|BE|比利时|比利時|Belgium': '🇧🇪',
  '🇦🇺|AU|澳大利亚|澳洲|墨尔本|悉尼|Australia|Sydney|AU': '🇦🇺',
  '🇨🇦|CA|加拿大|蒙特利尔|温哥华|多伦多|滑铁卢|楓葉|枫叶|CAN|Waterloo|Canada|CANADA': '🇨🇦',
  '🇲🇾|MY|马来西亚|马来|馬來|Malaysia|MALAYSIA|KualaLumpur': '🇲🇾',
  '🇲🇻|MV|马尔代夫|馬爾代夫|Maldives': '🇲🇻',
  '🇹🇷|TR|土耳其|伊斯坦布尔|TUR|Turkey': '🇹🇷',
  '🇵🇭|PH|菲律宾|菲律賓|Philippines': '🇵🇭',
  '🇹🇭|TH|泰国|泰國|曼谷|Thailand': '🇹🇭',
  '🇻🇳|VN|越南|胡志明市|Vietnam': '🇻🇳',
  '🇰🇭|KH|柬埔寨|Cambodia': '🇰🇭',
  '🇱🇦|LA|老挝|Laos': '🇱🇦',
  '🇧🇩|BD|孟加拉|Bengal': '🇧🇩',
  '🇲🇲|MM|缅甸|緬甸|Myanmar': '🇲🇲',
  '🇱🇧|LB|黎巴嫩|Lebanon': '🇱🇧',
  '🇺🇦|UA|乌克兰|烏克蘭|Ukraine': '🇺🇦',
  '🇭🇺|HU|匈牙利|Hungary': '🇭🇺',
  '🇨🇭|CH|瑞士|苏黎世|Switzerland': '🇨🇭',
  '🇸🇪|SE|瑞典|Sweden': '🇸🇪',
  '🇱🇺|LU|卢森堡|Luxembourg': '🇱🇺',
  '🇦🇹|AT|奥地利|奧地利|维也纳|Austria': '🇦🇹',
  '🇨🇿|CZ|捷克|Czechia': '🇨🇿',
  '🇬🇷|GR|希腊|希臘|Greece': '🇬🇷',
  '🇮🇸|IS|冰岛|冰島|ISL|Iceland': '🇮🇸',
  '🇳🇿|NZ|新西兰|新西蘭|New Zealand': '🇳🇿',
  '🇮🇪|IE|爱尔兰|愛爾蘭|都柏林|Ireland|IRELAND': '🇮🇪',
  '🇮🇲|IM|马恩岛|馬恩島|Mannin|Isle of Man': '🇮🇲',
  '🇱🇹|LT|立陶宛|Lithuania': '🇱🇹',
  '🇫🇮|FI|芬兰|芬蘭|赫尔辛基|Finland': '🇫🇮',
  '🇦🇷|AR|阿根廷|Argentina': '🇦🇷',
  '🇺🇾|UY|乌拉圭|烏拉圭|Uruguay': '🇺🇾',
  '🇵🇾|PY|巴拉圭|Paraguay': '🇵🇾',
  '🇯🇲|JM|牙买加|牙買加|Jamaica': '🇯🇲',
  '🇸🇷|SR|苏里南|蘇里南|Suriname': '🇸🇷',
  '🇨🇼|CW|库拉索|庫拉索|Curaçao': '🇨🇼',
  '🇨🇴|CO|哥伦比亚|Colombia': '🇨🇴',
  '🇪🇨|EC|厄瓜多尔|Ecuador': '🇪🇨',
  '🇪🇸|ES|西班牙|Spain': '🇪🇸',
  '🇵🇹|PT|葡萄牙|Portugal': '🇵🇹',
  '🇮🇱|IL|以色列|Israel': '🇮🇱',
  '🇸🇦|SA|沙特|利雅得|吉达|Saudi|Saudi Arabia': '🇸🇦',
  '🇲🇳|MN|蒙古|Mongolia': '🇲🇳',
  '🇦🇪|AE|阿联酋|迪拜|Dubai|United Arab Emirates': '🇦🇪',
  '🇦🇿|AZ|阿塞拜疆|Azerbaijan': '🇦🇿',
  '🇦🇲|AM|亚美尼亚|亞美尼亞|Armenia': '🇦🇲',
  '🇰🇿|KZ|哈萨克斯坦|哈薩克斯坦|Kazakhstan': '🇰🇿',
  '🇰🇬|KG|吉尔吉斯坦|吉尔吉斯斯坦|Kyrghyzstan': '🇰🇬',
  '🇺🇿|UZ|乌兹别克斯坦|烏茲別克斯坦|Uzbekistan': '🇺🇿',
  '🇧🇷|BR|巴西|圣保罗|维涅杜|(?<!G)BR|Brazil': '🇧🇷',
  '🇨🇱|CL|智利|Chile|CHILE': '🇨🇱',
  '🇵🇪|PE|秘鲁|祕魯|Peru': '🇵🇪',
  '🇨🇺|CU|古巴|Cuba': '🇨🇺',
  '🇧🇹|BT|不丹|Bhutan': '🇧🇹',
  '🇦🇩|AD|安道尔|Andorra': '🇦🇩',
  '🇲🇹|MT|马耳他|Malta': '🇲🇹',
  '🇲🇨|MC|摩纳哥|摩納哥|Monaco': '🇲🇨',
  '🇷🇴|RO|罗马尼亚|Rumania': '🇷🇴',
  '🇧🇬|BG|保加利亚|保加利亞|Bulgaria': '🇧🇬',
  '🇭🇷|HR|克罗地亚|克羅地亞|Croatia': '🇭🇷',
  '🇲🇰|MK|北马其顿|北馬其頓|North Macedonia': '🇲🇰',
  '🇷🇸|RS|塞尔维亚|塞爾維亞|Seville|Sevilla': '🇷🇸',
  '🇨🇾|CY|塞浦路斯|Cyprus': '🇨🇾',
  '🇱🇻|LV|拉脱维亚|Latvia|Latvija': '🇱🇻',
  '🇲🇩|MD|摩尔多瓦|摩爾多瓦|Moldova': '🇲🇩',
  '🇸🇰|SK|斯洛伐克|Slovakia': '🇸🇰',
  '🇪🇪|EE|爱沙尼亚|Estonia': '🇪🇪',
  '🇧🇾|BY|白俄罗斯|白俄羅斯|White Russia|Republic of Belarus|Belarus': '🇧🇾',
  '🇧🇳|BN|文莱|汶萊|BRN|Negara Brunei Darussalam': '🇧🇳',
  '🇬🇺|GU|关岛|關島|Guam': '🇬🇺',
  '🇫🇯|FJ|斐济|斐濟|Fiji': '🇫🇯',
  '🇯🇴|JO|约旦|約旦|Jordan': '🇯🇴',
  '🇬🇪|GE|格鲁吉亚|格魯吉亞|Georgia': '🇬🇪',
  '🇬🇮|GI|直布罗陀|直布羅陀|Gibraltar': '🇬🇮',
  '🇸🇲|SM|圣马力诺|聖馬利諾|San Marino': '🇸🇲',
  '🇳🇵|NP|尼泊尔|Nepal': '🇳🇵',
  '🇫🇴|FO|法罗群岛|法羅群島|Faroe Islands': '🇫🇴',
  '🇦🇽|AX|奥兰群岛|奧蘭群島|Åland': '🇦🇽',
  '🇸🇮|SI|斯洛文尼亚|斯洛文尼亞|Slovenia': '🇸🇮',
  '🇦🇱|AL|阿尔巴尼亚|阿爾巴尼亞|Albania': '🇦🇱',
  '🇹🇱|TL|东帝汶|東帝汶|East Timor': '🇹🇱',
  '🇵🇦|PA|巴拿马|巴拿馬|Panama': '🇵🇦',
  '🇧🇲|BM|百慕大|Bermuda': '🇧🇲',
  '🇬🇱|GL|格陵兰|格陵蘭|Greenland': '🇬🇱',
  '🇨🇷|CR|哥斯达黎加|Costa Rica': '🇨🇷',
  '🇻🇬|VG|英属维尔|British Virgin Islands': '🇻🇬',
  '🇻🇮|VI|美属维尔京|United States Virgin Islands': '🇻🇮',
  '🇲🇽|MX|墨西哥|MEX|MEXICO': '🇲🇽',
  '🇲🇪|ME|黑山|Montenegro': '🇲🇪',
  '🇳🇱|NL|荷兰|荷蘭|尼德蘭|阿姆斯特丹|Netherlands|Amsterdam': '🇳🇱',
  '🇵🇱|PL|波兰|波蘭|POL|Poland': '🇵🇱',
  '🇩🇿|DZ|阿尔及利亚|Algeria': '🇩🇿',
  '🇧🇦|BA|波黑共和国|波黑|Bosnia and Herzegovina': '🇧🇦',
  '🇱🇮|LI|列支敦士登|Liechtenstein': '🇱🇮',
  '🇷🇪|RE|留尼汪|留尼旺|Réunion|Reunion': '🇷🇪',
  '🇿🇦|ZA|南非|约翰内斯堡|South Africa|Johannesburg': '🇿🇦',
  '🇪🇬|EG|埃及|Egypt': '🇪🇬',
  '🇬🇭|GH|加纳|Ghana': '🇬🇭',
  '🇲🇱|ML|马里|馬里|Mali': '🇲🇱',
  '🇲🇦|MA|摩洛哥|Morocco': '🇲🇦',
  '🇹🇳|TN|突尼斯|Tunisia': '🇹🇳',
  '🇱🇾|LY|利比亚|Libya': '🇱🇾',
  '🇰🇪|KE|肯尼亚|肯尼亞|Kenya': '🇰🇪',
  '🇷🇼|RW|卢旺达|盧旺達|Rwanda': '🇷🇼',
  '🇨🇻|CV|佛得角|維德角|Cape Verde': '🇨🇻',
  '🇦🇴|AO|安哥拉|Angola': '🇦🇴',
  '🇳🇬|NG|尼日利亚|尼日利亞|拉各斯|Nigeria': '🇳🇬',
  '🇲🇺|MU|毛里求斯|Mauritius': '🇲🇺',
  '🇴🇲|OM|阿曼|Oman': '🇴🇲',
  '🇧🇭|BH|巴林|Bahrain': '🇧🇭',
  '🇮🇶|IQ|伊拉克|Iraq': '🇮🇶',
  '🇮🇷|IR|伊朗|Iran': '🇮🇷',
  '🇦🇫|AF|阿富汗|Afghanistan': '🇦🇫',
  '🇵🇰|PK|巴基斯坦|Pakistan|PAKISTAN': '🇵🇰',
  '🇶🇦|QA|卡塔尔|卡塔爾|Qatar': '🇶🇦',
  '🇸🇾|SY|叙利亚|敘利亞|Syria': '🇸🇾',
  '🇱🇰|LK|斯里兰卡|斯里蘭卡|Sri Lanka': '🇱🇰',
  '🇻🇪|VE|委内瑞拉|Venezuela': '🇻🇪',
  '🇬🇹|GT|危地马拉|Guatemala': '🇬🇹',
  '🇵🇷|PR|波多黎各|Puerto Rico': '🇵🇷',
  '🇰🇾|KY|开曼群岛|開曼群島|盖曼群岛|凯门群岛|Cayman Islands': '🇰🇾',
  '🇸🇯|SJ|斯瓦尔巴|扬马延|Svalbard|Mayen': '🇸🇯',
  '🇭🇳|HN|洪都拉斯|Honduras': '🇭🇳',
  '🇳🇮|NI|尼加拉瓜|Nicaragua': '🇳🇮',
  '🇦🇶|AQ|南极|南極|Antarctica': '🇦🇶',
  '🇨🇳|CN|中国|中國|江苏|北京|上海|广州|深圳|杭州|徐州|青岛|宁波|镇江|沈阳|济南|回国|back|China': '🇨🇳'
  // 添加更多的国家关键词和对应的 Emoji
}

const onSubscribe = async (proxies) => {
  const EnableAddEmoji = Plugin.EnableAddEmoji
  const EnableRemoveKeywords = Plugin.EnableRemoveKeywords
  const EnableIndexProxyName = Plugin.EnableIndexProxyName

  const isGFS = Plugins.APP_TITLE.includes('SingBox')
  const isGFC = Plugins.APP_TITLE.includes('Clash')

  if (EnableAddEmoji == 1) {
    const SubKeywordsToEmoji = {}
    for (const keyword in KeywordsToEmoji) {
      const emoji = KeywordsToEmoji[keyword]
      const Keywords = keyword.split('|')
      Keywords.forEach((word) => (SubKeywordsToEmoji[word] = emoji))
    }

    // 按子关键词长度从长到短排序
    const SortedKeywordsToEmoji = Object.fromEntries(
      Object.entries(SubKeywordsToEmoji).sort((a, b) => {
        if (a[0].length === b[0].length) {
          return a[0].localeCompare(b[0]) // 使用关键词的字典顺序进行比较
        }
        return b[0].length - a[0].length // 按照长度从长到短排序
      })
    )

    if (isGFS) {
      // 修改代理数组，根据节点名称添加对应的 emoji
      proxies = proxies.map((v, i) => {
        const lowercasetag = v.tag.toLowerCase()
        // Check if the proxy tag already starts with an emoji
        const codePoint = lowercasetag.codePointAt(0)
        if (codePoint >= 0x1F1E6 && codePoint <= 0x1F1FF) {
            const emoji = v.tag.slice(0, 4)
            if (v.tag[emoji.length] != ' ') {
              v.tag = emoji + ' ' + v.tag.slice(emoji.length)
            }
            return v
        }
        for (const keywords in SortedKeywordsToEmoji) {
          const regex = new RegExp(keywords, 'i')
          // Check if the proxy tag matches any keywords
          if (regex.test(lowercasetag)) {
            const emoji = SortedKeywordsToEmoji[keywords]
            v.tag = emoji + ' ' + v.tag // Add emoji and space before the proxy tag
            break // Break out of loop after the first match
          }
        }
        return v
      })
    } else if (isGFC) {
      // 修改代理数组，根据节点名称添加对应的 emoji
      proxies = proxies.map((v, i) => {
        const lowercaseName = v.name.toLowerCase()
        let shouldAddEmoji = true // Flag to track whether emoji should be added
        for (const keywords in SortedKeywordsToEmoji) {
          const regex = new RegExp(keywords, 'i')
          // Check if the proxy name matches any keywords
          if (regex.test(lowercaseName)) {
            const emoji = SortedKeywordsToEmoji[keywords]
            // Check if the proxy name already starts with an emoji
            if (v.name.startsWith(emoji)) {
              shouldAddEmoji = false // If the proxy name already has an emoji, do not add another one
            } else {
              v.name = emoji + ' ' + v.name // Add emoji and space before the proxy name
            }
            break // Break out of loop after the first match
          }
        }
        return shouldAddEmoji ? v : { ...v } // If emoji should not be added, return original, otherwise return modified proxy
      })
    }
  }

  if (EnableRemoveKeywords == 1) {
    if (isGFS) {
      proxies = proxies.map((v) => {
        return {
          ...v,
          tag: v.tag.replace(RemoveKeywords, '')
        }
      })
    } else if (isGFC) {
      proxies = proxies.map((v) => {
        return {
          ...v,
          name: v.name.replace(RemoveKeywords, '')
        }
      })
    }
  }

  if (EnableIndexProxyName == 1) {
    if (isGFS) {
      proxies = proxies.map((v, i) => ({ ...v, tag: v.tag + ' ' + (i + 1) }))
    } else if (isGFC) {
      proxies = proxies.map((v, i) => ({ ...v, name: v.name + ' ' + (i + 1) }))
    }
  }

  if (EnableIndexProxyName == 2) {
    let seenNames = {} // 用于记录已经出现过的节点名称的集合

    if (isGFS) {
      proxies = proxies.map((v, i) => {
        if (seenNames[v.tag]) {
          seenNames[v.tag]++
        } else {
          seenNames[v.tag] = 1
        }
        // 只有当节点名称重复时才添加标号
        const tagWithIndex = seenNames[v.tag] > 1 ? v.tag + ' ' + seenNames[v.tag] : v.tag
        return {
          ...v,
          tag: tagWithIndex
        }
      })
    } else if (isGFC) {
      proxies = proxies.map((v, i) => {
        if (seenNames[v.name]) {
          seenNames[v.name]++
        } else {
          seenNames[v.name] = 1
        }
        // 只有当节点名称重复时才添加标号
        const nameWithIndex = seenNames[v.name] > 1 ? v.name + ' ' + seenNames[v.name] : v.name
        return {
          ...v,
          name: nameWithIndex
        }
      })
    }
  }
  return proxies
}
