const settingconfig = async () => {
    const configname = "plugin-scamalytics-ip-fraud-risk-config";
    const configpath = "data/plugins/plugins-configs/" + configname + ".yaml";

    const hostname =await Plugins.prompt(
        '请输入 hostname (provided by Scamalytics)',
        '' /* 'initialValue' */,
        {
        placeholder: '例如: api11.scamalytics.com'
        }
    );

    const username =await Plugins.prompt(
        '请输入申请 Scamalytics API KEY 时填写的 usename',
        '' /* 'initialValue' */,
        {
        placeholder: 'usename'
        }
    );

    const key =await Plugins.prompt(
        '请输入 Scamalytics API KEY',
        '' /* 'initialValue' */,
        {
        placeholder: 'Scamalytics API KEY'
        }
    );
    
    const code = `
hostname: ${hostname}
username: ${username}
key: ${key}
`;
    await Plugins.Writefile(configpath, code);
    Plugins.message.success("设置插件配置成功");
};

const checkIpFraudRisk = async (ip) => {
    const configpath = './data/plugins/plugins-configs/plugin-scamalytics-ip-fraud-risk-config.yaml';

    let fileExists = false;
    try {
        const yamlContent = await Plugins.Readfile(configpath);
        fileExists = true;
    } catch (error) {
        fileExists = false;
        // 文件不存在时执行的代码
        await settingconfig();
        Plugins.message.success("通过右键插件可重新设置", 3_000);
    };

    // 读取 YAML 文件
    const yamlContent = await Plugins.Readfile(configpath)
    // 解析 YAML 内容
    const yamlData = Plugins.YAML.parse(yamlContent)

    // 将 YAML 中的值赋给不同的变量
    const hostname = yamlData.hostname
    const username = yamlData.username
    const key = yamlData.key

    const url = `https://${hostname}/${username}/?ip=${ip}&key=${key}&test=0`;
    const { json } = await Plugins.HttpGetJSON(url);

    let status = json.status;
    let score = json.score;
    let risk = json.risk;

    if (status === 'error') {
        const text1 = `💥 Status of the request is error 💥`;

        const message = `
        ${text1}`;

        Plugins.confirm(
            'Error❗❗❗',
            message
        )
    } else {
        let scoreemoji = "🔢";
        let levelemoji ="🌟";
        let riskemoji;
        if (risk === "very high") {
            riskemoji = "🔴"; // 代表非常高风险
        } else if (risk === "high") {
            riskemoji = "🟠"; // 代表高风险
        } else if (risk === "medium") {
            riskemoji = "🟡"; // 代表中等风险
        } else if (risk === "low") {
            riskemoji = "🟢"; // 代表低风险
        };

        const text1 = `🌐 IP: ${ip} ${scoreemoji} Risk score: ${score}`;
        const text2 = `${riskemoji} Discrete risk level: ${risk}`;

        const message = `
        ${text1}
        ${text2}`;

        Plugins.confirm(
            'Scamalytics IP 欺诈风险',
            message
        )
    }
};

const getip = async () => {
    const { json } = await Plugins.HttpGetJSON('https://ipapi.co/json')
    // 将 json 中的值赋给不同的变量
    let ip = json.ip;
    return ip;
};

const onRun = async () => {
    await getip();
    const ip = await getip();
    await checkIpFraudRisk(ip);
};

const manual = async () => {
    const ip =await Plugins.prompt(
        '请输入需要查询的 IP 地址',
        '' /* 'initialValue' */,
        {
        placeholder: 'IP 地址，例如: 1.1.1.1'
        }
    );
    await checkIpFraudRisk(ip);
};
