const onRun = async () => {
    const flags = new Map([["AC","🇦🇨"],["AD","🇦🇩"],["AE","🇦🇪"],["AF","🇦🇫"],["AG","🇦🇬"],["AI","🇦🇮"],["AL","🇦🇱"],["AM","🇦🇲"],["AO","🇦🇴"],["AQ","🇦🇶"],["AR","🇦🇷"],["AS","🇦🇸"],["AT","🇦🇹"],["AU","🇦🇺"],["AW","🇦🇼"],["AX","🇦🇽"],["AZ","🇦🇿"],["BA","🇧🇦"],["BB","🇧🇧"],["BD","🇧🇩"],["BE","🇧🇪"],["BF","🇧🇫"],["BG","🇧🇬"],["BH","🇧🇭"],["BI","🇧🇮"],["BJ","🇧🇯"],["BM","🇧🇲"],["BN","🇧🇳"],["BO","🇧🇴"],["BR","🇧🇷"],["BS","🇧🇸"],["BT","🇧🇹"],["BV","🇧🇻"],["BW","🇧🇼"],["BY","🇧🇾"],["BZ","🇧🇿"],["CA","🇨🇦"],["CD","🇨🇩"],["CF","🇨🇫"],["CG","🇨🇬"],["CH","🇨🇭"],["CI","🇨🇮"],["CK","🇨🇰"],["CL","🇨🇱"],["CM","🇨🇲"],["CN","🇨🇳"],["CO","🇨🇴"],["CP","🇫🇷"],["CR","🇨🇷"],["CU","🇨🇺"],["CV","🇨🇻"],["CW","🇨🇼"],["CX","🇨🇽"],["CY","🇨🇾"],["CZ","🇨🇿"],["DE","🇩🇪"],["DG","🇩🇬"],["DJ","🇩🇯"],["DK","🇩🇰"],["DM","🇩🇲"],["DO","🇩🇴"],["DZ","🇩🇿"],["EA","🇪🇦"],["EC","🇪🇨"],["EE","🇪🇪"],["EG","🇪🇬"],["EH","🇪🇭"],["ER","🇪🇷"],["ES","🇪🇸"],["ET","🇪🇹"],["EU","🇪🇺"],["FI","🇫🇮"],["FJ","🇫🇯"],["FK","🇫🇰"],["FM","🇫🇲"],["FO","🇫🇴"],["FR","🇫🇷"],["GA","🇬🇦"],["GB","🇬🇧"],["GD","🇬🇩"],["GE","🇬🇪"],["GF","🇬🇫"],["GH","🇬🇭"],["GI","🇬🇮"],["GL","🇬🇱"],["GM","🇬🇲"],["GN","🇬🇳"],["GP","🇬🇵"],["GR","🇬🇷"],["GT","🇬🇹"],["GU","🇬🇺"],["GW","🇬🇼"],["GY","🇬🇾"],["HK","🇭🇰"],["HN","🇭🇳"],["HR","🇭🇷"],["HT","🇭🇹"],["HU","🇭🇺"],["ID","🇮🇩"],["IE","🇮🇪"],["IL","🇮🇱"],["IM","🇮🇲"],["IN","🇮🇳"],["IR","🇮🇷"],["IS","🇮🇸"],["IT","🇮🇹"],["JM","🇯🇲"],["JO","🇯🇴"],["JP","🇯🇵"],["KE","🇰🇪"],["KG","🇰🇬"],["KH","🇰🇭"],["KI","🇰🇮"],["KM","🇰🇲"],["KN","🇰🇳"],["KP","🇰🇵"],["KR","🇰🇷"],["KW","🇰🇼"],["KY","🇰🇾"],["KZ","🇰🇿"],["LA","🇱🇦"],["LB","🇱🇧"],["LC","🇱🇨"],["LI","🇱🇮"],["LK","🇱🇰"],["LR","🇱🇷"],["LS","🇱🇸"],["LT","🇱🇹"],["LU","🇱🇺"],["LV","🇱🇻"],["LY","🇱🇾"],["MA","🇲🇦"],["MC","🇲🇨"],["MD","🇲🇩"],["MG","🇲🇬"],["MH","🇲🇭"],["MK","🇲🇰"],["ML","🇲🇱"],["MM","🇲🇲"],["MN","🇲🇳"],["MO","🇲🇴"],["MP","🇲🇵"],["MQ","🇲🇶"],["MR","🇲🇷"],["MS","🇲🇸"],["MT","🇲🇹"],["MU","🇲🇺"],["MV","🇲🇻"],["MW","🇲🇼"],["MX","🇲🇽"],["MY","🇲🇾"],["MZ","🇲🇿"],["NA","🇳🇦"],["NC","🇳🇨"],["NE","🇳🇪"],["NF","🇳🇫"],["NG","🇳🇬"],["NI","🇳🇮"],["NL","🇳🇱"],["NO","🇳🇴"],["NP","🇳🇵"],["NR","🇳🇷"],["NZ","🇳🇿"],["OM","🇴🇲"],["PA","🇵🇦"],["PE","🇵🇪"],["PF","🇵🇫"],["PG","🇵🇬"],["PH","🇵🇭"],["PK","🇵🇰"],["PL","🇵🇱"],["PM","🇵🇲"],["PR","🇵🇷"],["PS","🇵🇸"],["PT","🇵🇹"],["PW","🇵🇼"],["PY","🇵🇾"],["QA","🇶🇦"],["RE","🇷🇪"],["RO","🇷🇴"],["RS","🇷🇸"],["RU","🇷🇺"],["RW","🇷🇼"],["SA","🇸🇦"],["SB","🇸🇧"],["SC","🇸🇨"],["SD","🇸🇩"],["SE","🇸🇪"],["SG","🇸🇬"],["SI","🇸🇮"],["SK","🇸🇰"],["SL","🇸🇱"],["SM","🇸🇲"],["SN","🇸🇳"],["SR","🇸🇷"],["ST","🇸🇹"],["SV","🇸🇻"],["SY","🇸🇾"],["SZ","🇸🇿"],["TC","🇹🇨"],["TD","🇹🇩"],["TG","🇹🇬"],["TH","🇹🇭"],["TJ","🇹🇯"],["TL","🇹🇱"],["TM","🇹🇲"],["TN","🇹🇳"],["TO","🇹🇴"],["TR","🇹🇷"],["TT","🇹🇹"],["TV","🇹🇻"],["TW","🇹🇼"],["TZ","🇹🇿"],["UA","🇺🇦"],["UG","🇺🇬"],["UK","🇬🇧"],["UM","🇺🇲"],["US","🇺🇸"],["UY","🇺🇾"],["UZ","🇺🇿"],["VA","🇻🇦"],["VC","🇻🇨"],["VE","🇻🇪"],["VG","🇻🇬"],["VI","🇻🇮"],["VN","🇻🇳"],["VU","🇻🇺"],["WS","🇼🇸"],["YE","🇾🇪"],["YT","🇾🇹"],["ZA","🇿🇦"],["ZM","🇿🇲"],["ZW","🇿🇼"],["BTN","努扎姆"],["INR","印度卢比"],["CNY","人民币元"],["MOP","澳元"],["HKD","港元"],["XAF","多哥非洲共同体法郎"],["DKK","丹麦克朗"],["UAH","格里夫尼亚"],["UZS","乌兹别克斯坦萨"],["UGX","乌干达先令"],["UYI","乌拉圭比索"],["UYU","乌拉圭比索"],["XAF","多哥非洲共同体法郎"],["YER","也门里亚尔"],["AMD","亚美尼亚德拉姆"],["ILS","新谢克尔"],["IQD","伊拉克第纳尔"],["IRR","伊朗里亚尔"],["BWP","普拉"],["BZD","伯利兹元"],["RUB","俄罗斯卢布"],["BGN","保加利亚列瓦"],["HRK","库纳"],["USD","美元"],["GMD","达拉西"],["ISK","冰岛克朗"],["GNF","几内亚法郎"],["XOF","多哥非洲共同体法郎"],["CHF","瑞士法郎"],["XAF","多哥非洲共同体法郎"],["CDF","刚果法郎"],["LYD","利比亚第纳尔"],["LRD","利比里亚元"],["CAD","加元"],["GHS","加纳赛地"],["XAF","多哥非洲共同体法郎"],["HUF","福林"],["USD","美元"],["SSP","南苏丹镑"],["ZAR","兰特"],["USD","美元"],["QAR","卡塔尔里亚尔"],["RWF","卢旺达法郎"],["EUR","欧元"],["INR","印度卢比"],["IDR","卢比"],["GTQ","格查尔"],["USD","美元"],["ERN","纳法克"],["CUC","可兑换比索"],["CUP","古巴比索"],["TWD","新台币元"],["KGS","索姆"],["DJF","吉布提法郎"],["KZT","腾格"],["COP","哥伦比亚比索"],["COU","哥伦比亚UnidaddeValorReal"],["CRC","哥斯达尼家科朗"],["XAF","多哥非洲共同体法郎"],["XDR","SDR(特别提款权）"],["AUD","澳元"],["TMT","土库曼斯坦新马纳特"],["TRY","土耳其里拉"],["XCD","东加勒比元"],["XCD","东加勒比元"],["STN","多布拉"],["EUR","欧元"],["XCD","东加勒比元"],["EUR","欧元"],["AUD","澳元"],["SHP","圣赫勒拿镑"],["EUR","欧元"],["ANG","荷属安的列斯盾"],["EUR","欧元"],["GYD","圭亚那元"],["TZS","坦桑尼亚先令"],["EGP","埃及镑"],["ETB","埃塞俄比亚比尔"],["AUD","澳元"],["TJS","索摩尼"],["XOF","多哥非洲共同体法郎"],["RSD","塞尔维亚第纳尔"],["SLL","利昂"],["EUR","欧元"],["SCR","塞舌尔卢比"],["MXN","墨西哥比索"],["MXV","墨西哥基金（UDI）"],["XOF","多哥非洲共同体法郎"],["XCD","东加勒比元"],["DOP","多米尼加比索"],["GBP","英镑"],["EUR","欧元"],["EUR","欧元"],["VEF","玻利瓦尔"],["BDT","塔卡"],["AOA","宽扎"],["XCD","东加勒比元"],["XCD","东加勒比元"],["EUR","欧元"],["USD","美元"],["NIO","尼加拉瓜新科多巴"],["NGN","奈拉"],["XOF","多哥非洲共同体法郎"],["NPR","尼泊尔卢比"],["BSD","巴哈马元"],["PKR","巴基斯坦卢比"],["BBD","巴巴多斯元"],["PGK","基那"],["PYG","瓜拉尼"],["PAB","巴波亚"],["USD","美元"],["BHD","巴林第纳尔"],["BRL","巴西雷亚尔"],["XOF","多哥非洲共同体法郎"],["NOK","挪威克朗"],["BIF","布隆迪法郎"],["EUR","欧元"],["USD","美元"],["USD","美元"],["NZD","新西兰元"],["ANG","荷属安的列斯盾"],["KYD","开曼群岛元"],["EUR","欧元"],["EUR","欧元"],["SBD","所罗门群岛元"],["NZD","新西兰元"],["EUR","欧元"],["NOK","挪威克朗"],["CZK","捷克克朗"],["MDL","摩尔多瓦尼乌"],["MAD","摩洛哥迪拉姆"],["EUR","欧元"],["BND","文莱元"],["FJD","斐济元"],["SZL","里兰基尼"],["EUR","欧元"],["EUR","欧元"],["NOK","挪威克朗"],["LKR","斯里兰卡卢比"],["SGD","新加坡元"],["XPF","非洲金融共同体法郎"],["NZD","新西兰元"],["JPY","日元"],["CLF","智利资金"],["CLP","智利比索"],["KPW","朝鲜圆"],["KHR","瑞尔"],["GBP","英镑"],["XCD","东加勒比元"],["DKK","丹麦克朗"],["GEL","拉里"],["EUR","欧元"],["EUR","欧元"],["EUR","欧元"],["MRU","乌吉亚"],["MUR","毛里求斯卢比"],["TOP","潘加’"],["SAR","沙特里亚尔"],["EUR","欧元"],["EUR","欧元"],["EUR","欧元"],["XPF","非洲金融共同体法郎"],["DKK","丹麦克朗"],["PLN","兹罗提"],["USD","美元"],["BAM","可兑换马克"],["THB","泰铢"],["GBP","英镑"],["ZWL","津巴布韦元"],["HNL","伦皮拉"],["HTG","古德"],["USD","美元"],["AUD","澳元"],["EUR","欧元"],["EUR","欧元"],["JMD","牙买加元"],["USD","美元"],["TTD","特立达与多巴哥元"],["BOB","玻利维亚诺"],["BOV","玻利维亚资金"],["AUD","澳元"],["SEK","瑞典克朗"],["CHE","WIR欧元"],["CHF","瑞士法郎"],["CHW","WIR法郎"],["EUR","欧元"],["XPF","非洲金融共同体法郎"],["VUV","瓦图"],["EUR","欧元"],["BYR","白俄罗斯卢布"],["BMD","百慕大元"],["NZD","新西兰元"],["GIP","直布罗陀镑"],["FKP","福克兰群岛镑"],["AUD","澳元"],["KWD","科威特第纳尔"],["KMF","科摩罗法郎"],["XOF","多哥非洲共同体法郎"],["PEN","新索尔"],["TND","突尼斯第纳尔"],["EUR","欧元"],["SOS","索马里先令"],["JOD","约旦第纳尔"],["NAD","纳米比亚元"],["ZAR","兰特"],["NZD","新西兰元"],["CVE","佛得角埃斯库多"],["MMK","缅甸元"],["RON","罗马尼亚列伊"],["USD","美元"],["USN","美元（次日）"],["USD","美元"],["USD","美元USDollar"],["USD","美元"],["LAK","基普"],["KES","肯尼亚先令"],["EUR","欧元"],["SDG","苏丹镑"],["SRD","苏里南元"],["GBP","英镑"],["USD","美元"],["USD","美元"],["EUR","欧元"],["MZN","莫桑比克梅蒂卡尔"],["LSL","鲁梯"],["ZAR","兰特"],["PHP","菲律宾比索"],["SVC","萨尔瓦多科朗"],["USD","美元"],["WST","塔拉"],["EUR","欧元"],["MNT","图格里克"],["XCD","东加勒比元"],["MAD","摩洛哥迪纳姆"],["EUR","欧元"],["AUD","澳元"],["XOF","多哥非洲共同体法郎"],["ZMW","赞比亚克瓦查"],["XAF","多哥非洲共同体法郎"],["AUD","澳元"],["VND","越南盾"],["AZN","阿塞拜疆马纳特"],["AFN","阿尼"],["DZD","阿尔及利亚第纳尔"],["ALL","列克"],["SYP","叙利亚镑"],["AED","阿联酋迪拉姆"],["OMR","阿曼里亚尔"],["ARS","阿根廷比索"],["AWG","阿鲁巴弗洛林"],["XUA","非洲发展银行账户单位"],["KRW","韩元"],["MKD","第纳尔"],["MVR","拉菲亚"],["MWK","克瓦查"],["EUR","欧元"],["MYR","马来西亚林吉特"],["EUR","欧元"],["USD","美元"],["EUR","欧元"],["MGA","阿里亚里"],["XOF","多哥非洲共同体法郎"],["LBP","黎巴嫩镑"],["EUR","欧元"]])

    // 生成随机数
    const randomNumber = Math.floor(Math.random() * 1000000); // 生成 0 到 999999 之间的随机整数
    // 生成带有随机数的文件名
    const randomFileName =  `ipfile_${randomNumber}`;

    const url = "https://ipapi.co/yaml";
    const path = "data/plugins/plugins-configs/" + randomFileName + ".yaml";

    try {
        await Plugins.Download(url, path);
        fileExists = true;
    } catch (error) {
        fileExists = false;
        Plugins.message.info("获取 IP 信息失败");
    };

    if (fileExists) {
        // 读取 YAML 文件
        const yamlContent = await Plugins.Readfile(path)

        // 解析 YAML 内容
        const yamlData = Plugins.YAML.parse(yamlContent)

        // 将 YAML 中的值赋给不同的变量
        let ip = yamlData.ip
        let country = yamlData.country
        let region = yamlData.region
        let city = yamlData.city
        let timezone = yamlData.timezone

        // 根据 country 的值获取对应的 emoji
        const emoji = flags.get(country) || "❓"; // 默认值为❓

        if (ip === null) {
            ip = '';
        }
        
        if (country === null) {
            country = '';
        }
        
        if (region === null) {
            region = '';
        }
        
        if (city === null) {
            city = '';
        }
        
        if (timezone === null) {
            timezone = '';
        }

        const text1 = `${emoji} ${region} ${city}`;
        const text2 = `🌐 IP: ${ip}`;
        const text3 = `🕗 时区: ${timezone}`;

        const message = `
        ${text1}
        ${text2}
        ${text3}`;

        Plugins.confirm(
            'IP 信息',
            message
        )
    };

    await Plugins.Removefile(path);
}
