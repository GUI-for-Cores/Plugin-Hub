// 使用正则表达式来表示关键词
const keywordsToEmoji = {
    '香港|沪港|呼港|中港|HKT|HKBN|HGC|WTT|CMI|穗港|广港|京港|🇭🇰|HK|Hongkong|Hong Kong|HongKong|HONG KONG': '🇭🇰',
    '台湾|台灣|臺灣|台北|台中|新北|彰化|台|CHT|HINET|TW|Taiwan|TAIWAN': '🇹🇼',
    '澳门|澳門|CTM|MAC|Macao|Macau': '🇲🇴',
    '新加坡|狮城|獅城|沪新|京新|泉新|穗新|深新|杭新|广新|廣新|滬新|SG|Singapore|SINGAPORE': '🇸🇬',
    '日本|东京|大阪|埼玉|京日|苏日|沪日|广日|上日|穗日|川日|中日|泉日|杭日|深日|JP|Japan|JAPAN': '🇯🇵',
    '美国|美國|京美|硅谷|凤凰城|洛杉矶|西雅图|圣何塞|芝加哥|哥伦布|纽约|广美|USA|America|United States': '🇺🇸',
    '韩国|韓國|首尔|韩|韓|春川|KOR|KR|Kr|Korea': '🇰🇷',
    '朝鲜|KP|North Korea': '🇰🇵',
    '俄罗斯|俄羅斯|毛子|俄国|RU|RUS|Russia': '🇷🇺',
    '印度|孟买|IN|IND|India|INDIA|Mumbai': '🇮🇳',
    '印尼|印度尼西亚|雅加达|ID|IDN|Indonesia': '🇮🇩',
    '英国|英國|伦敦|UK|England|United Kingdom|Britain': '🇬🇧',
    '德国|德國|法兰克福|🇩🇪|German|GERMAN': '🇩🇪',
    '法国|法國|巴黎|FR|France': '🇫🇷',
    '丹麦|丹麥|DK|DNK|Denmark': '🇩🇰',
    '挪威|Norway': '🇳🇴',
    '意大利|義大利|米兰|Italy|Nachash': '🇮🇹',
    '梵蒂冈|梵蒂岡|Vatican City': '🇻🇦',
    '比利时|比利時|Belgium': '🇧🇪',
    '澳大利亚|澳洲|墨尔本|悉尼|Australia|Sydney': '🇦🇺',
    '加拿大|蒙特利尔|温哥华|多伦多|滑铁卢|楓葉|枫叶|CA|CAN|Waterloo|Canada|CANADA': '🇨🇦',
    '马来西亚|马来|馬來|MY|Malaysia|MALAYSIA': '🇲🇾',
    '马尔代夫|馬爾代夫|Maldives': '🇲🇻',
    '土耳其|伊斯坦布尔|TR_|TUR|Turkey': '🇹🇷',
    '菲律宾|菲律賓|Philippines': '🇵🇭',
    '泰国|泰國|曼谷|Thailand': '🇹🇭',
    '越南|胡志明市|Vietnam': '🇻🇳',
    '柬埔寨|Cambodia': '🇰🇭',
    '老挝|Laos': '🇱🇦',
    '孟加拉|Bengal': '🇧🇩',
    '缅甸|緬甸|Myanmar': '🇲🇲',
    '黎巴嫩|Lebanon': '🇱🇧',
    '乌克兰|烏克蘭|Ukraine': '🇺🇦',
    '匈牙利|Hungary': '🇭🇺',
    '瑞士|苏黎世|Switzerland': '🇨🇭',
    '瑞典|SE|Sweden': '🇸🇪',
    '卢森堡|Luxembourg': '🇱🇺',
    '奥地利|奧地利|维也纳|Austria': '🇦🇹',
    '捷克|Czechia': '🇨🇿',
    '希腊|希臘|Greece': '🇬🇷',
    '冰岛|冰島|ISL|Iceland': '🇮🇸',
    '新西兰|新西蘭|New Zealand': '🇳🇿',
    '爱尔兰|愛爾蘭|都柏林|Ireland|IRELAND': '🇮🇪',
    '马恩岛|馬恩島|Mannin|Isle of Man': '🇮🇲',
    '立陶宛|Lithuania': '🇱🇹',
    '芬兰|芬蘭|赫尔辛基|Finland': '🇫🇮',
    '阿根廷|Argentina': '🇦🇷',
    '乌拉圭|烏拉圭|Uruguay': '🇺🇾',
    '巴拉圭|Paraguay': '🇵🇾',
    '牙买加|牙買加|Jamaica': '🇯🇲',
    '苏里南|蘇里南|Suriname': '🇸🇷',
    '库拉索|庫拉索|Curaçao': '🇨🇼',
    '哥伦比亚|Colombia': '🇨🇴',
    '厄瓜多尔|Ecuador': '🇪🇨',
    '西班牙|Spain': '🇪🇸',
    '葡萄牙|Portugal': '🇵🇹',
    '以色列|Israel': '🇮🇱',
    '沙特|利雅得|吉达|Saudi|Saudi Arabia': '🇸🇦',
    '蒙古|Mongolia': '🇲🇳',
    '阿联酋|迪拜|Dubai|United Arab Emirates': '🇦🇪',
    '阿塞拜疆|Azerbaijan': '🇦🇿',
    '亚美尼亚|亞美尼亞|Armenia': '🇦🇲',
    '哈萨克斯坦|哈薩克斯坦|Kazakhstan': '🇰🇿',
    '吉尔吉斯坦|吉尔吉斯斯坦|Kyrghyzstan': '🇰🇬',
    '乌兹别克斯坦|烏茲別克斯坦|Uzbekistan': '🇺🇿',
    '巴西|圣保罗|维涅杜|(?<!G)BR|Brazil': '🇧🇷',
    '智利|Chile|CHILE': '🇨🇱',
    '秘鲁|祕魯|Peru': '🇵🇪',
    '古巴|Cuba': '🇨🇺',
    '不丹|Bhutan': '🇧🇹',
    '安道尔|Andorra': '🇦🇩',
    '马耳他|Malta': '🇲🇹',
    '摩纳哥|摩納哥|Monaco': '🇲🇨',
    '罗马尼亚|Rumania': '🇷🇴',
    '保加利亚|保加利亞|Bulgaria': '🇧🇬',
    '克罗地亚|克羅地亞|Croatia': '🇭🇷',
    '北马其顿|北馬其頓|North Macedonia': '🇲🇰',
    '塞尔维亚|塞爾維亞|Seville|Sevilla': '🇷🇸',
    '塞浦路斯|Cyprus': '🇨🇾',
    '拉脱维亚|Latvia|Latvija': '🇱🇻',
    '摩尔多瓦|摩爾多瓦|Moldova': '🇲🇩',
    '斯洛伐克|Slovakia': '🇸🇰',
    '爱沙尼亚|Estonia': '🇪🇪',
    '白俄罗斯|白俄羅斯|White Russia|Republic of Belarus|Belarus': '🇧🇾',
    '文莱|汶萊|BRN|Negara Brunei Darussalam': '🇧🇳',
    '关岛|關島|Guam': '🇬🇺',
    '斐济|斐濟|Fiji': '🇫🇯',
    '约旦|約旦|Jordan': '🇯🇴',
    '格鲁吉亚|格魯吉亞|Georgia': '🇬🇪',
    '直布罗陀|直布羅陀|Gibraltar': '🇬🇮',
    '圣马力诺|聖馬利諾|San Marino': '🇸🇲',
    '尼泊尔|Nepal': '🇳🇵',
    '法罗群岛|法羅群島|Faroe Islands': '🇫🇴',
    '奥兰群岛|奧蘭群島|Åland': '🇦🇽',
    '斯洛文尼亚|斯洛文尼亞|Slovenia': '🇸🇮',
    '阿尔巴尼亚|阿爾巴尼亞|Albania': '🇦🇱',
    '东帝汶|東帝汶|East Timor': '🇹🇱',
    '巴拿马|巴拿馬|Panama': '🇵🇦',
    '百慕大|Bermuda': '🇧🇲',
    '格陵兰|格陵蘭|Greenland': '🇬🇱',
    '哥斯达黎加|Costa Rica': '🇨🇷',
    '英属维尔|British Virgin Islands': '🇻🇬',
    '美属维尔京|United States Virgin Islands': '🇻🇮',
    '墨西哥|MX|MEX|MEX|MEXICO': '🇲🇽',
    '黑山|Montenegro': '🇲🇪',
    '荷兰|荷蘭|尼德蘭|阿姆斯特丹|NL|Netherlands|Amsterdam': '🇳🇱',
    '波兰|波蘭|POL|Poland': '🇵🇱',
    '阿尔及利亚|Algeria': '🇩🇿',
    '波黑共和国|波黑|Bosnia and Herzegovina': '🇧🇦',
    '列支敦士登|Liechtenstein': '🇱🇮',
    '留尼汪|留尼旺|Réunion|Reunion': '🇷🇪',
    '南非|约翰内斯堡|South Africa|Johannesburg': '🇿🇦',
    '埃及|Egypt': '🇪🇬',
    '加纳|Ghana': '🇬🇭',
    '马里|馬里|Mali': '🇲🇱',
    '摩洛哥|Morocco': '🇲🇦',
    '突尼斯|Tunisia': '🇹🇳',
    '利比亚|Libya': '🇱🇾',
    '肯尼亚|肯尼亞|Kenya': '🇰🇪',
    '卢旺达|盧旺達|Rwanda': '🇷🇼',
    '佛得角|維德角|Cape Verde': '🇨🇻',
    '安哥拉|Angola': '🇦🇴',
    '尼日利亚|尼日利亞|拉各斯|Nigeria': '🇳🇬',
    '毛里求斯|Mauritius': '🇲🇺',
    '阿曼|Oman': '🇴🇲',
    '巴林|Bahrain': '🇧🇭',
    '伊拉克|Iraq': '🇮🇶',
    '伊朗|Iran': '🇮🇷',
    '阿富汗|Afghanistan': '🇦🇫',
    '巴基斯坦|Pakistan|PAKISTAN': '🇵🇰',
    '卡塔尔|卡塔爾|Qatar': '🇶🇦',
    '叙利亚|敘利亞|Syria': '🇸🇾',
    '斯里兰卡|斯里蘭卡|Sri Lanka': '🇱🇰',
    '委内瑞拉|Venezuela': '🇻🇪',
    '危地马拉|Guatemala': '🇬🇹',
    '波多黎各|Puerto Rico': '🇵🇷',
    '开曼群岛|開曼群島|盖曼群岛|凯门群岛|Cayman Islands': '🇰🇾',
    '斯瓦尔巴|扬马延|Svalbard|Mayen': '🇸🇯',
    '洪都拉斯|Honduras': '🇭🇳',
    '尼加拉瓜|Nicaragua': '🇳🇮',
    '南极|南極|Antarctica': '🇦🇶',
    '中国|中國|江苏|北京|上海|广州|深圳|杭州|徐州|青岛|宁波|镇江|沈阳|济南|回国|back|China': '🇨🇳'
    // 添加更多的国家关键词和对应的 emoji
};

const { appName } = await Plugins.GetEnv()

const onSubscribe = async (proxies) => {
    if(appName.toLowerCase().includes('singbox')) {
        // 修改代理数组，根据节点名称添加对应的 emoji
        proxies = proxies.map((v, i) => {
            const lowercasetag = v.tag.toLowerCase();
            let shouldAddEmoji = true; // Flag to track whether emoji should be added
            for (const keywords in keywordsToEmoji) {
                const regex = new RegExp(keywords, 'i');
                // Check if the proxy tag matches any keywords
                if (regex.test(lowercasetag)) {
                    const emoji = keywordsToEmoji[keywords];
                    // Check if the proxy tag already starts with an emoji
                    if (v.tag.startsWith(emoji)) {
                        shouldAddEmoji = false; // If the proxy tag already has an emoji, do not add another one
                    } else {
                        v.tag = emoji + ' ' + v.tag; // Add emoji and space before the proxy tag
                    }
                    break; // Break out of loop after the first match
                }
            }
            return shouldAddEmoji ? v : {...v}; // If emoji should not be added, return original, otherwise return modified proxy
        });
    }else if(appName.toLowerCase().includes('clash')) {
        // 修改代理数组，根据节点名称添加对应的 emoji
        proxies = proxies.map((v, i) => {
            const lowercaseName = v.name.toLowerCase();
            let shouldAddEmoji = true; // Flag to track whether emoji should be added
            for (const keywords in keywordsToEmoji) {
                const regex = new RegExp(keywords, 'i');
                // Check if the proxy name matches any keywords
                if (regex.test(lowercaseName)) {
                    const emoji = keywordsToEmoji[keywords];
                    // Check if the proxy name already starts with an emoji
                    if (v.name.startsWith(emoji)) {
                        shouldAddEmoji = false; // If the proxy name already has an emoji, do not add another one
                    } else {
                        v.name = emoji + ' ' + v.name; // Add emoji and space before the proxy name
                    }
                    break; // Break out of loop after the first match
                }
            }
            return shouldAddEmoji ? v : {...v}; // If emoji should not be added, return original, otherwise return modified proxy
        });
    }
    return proxies
}
