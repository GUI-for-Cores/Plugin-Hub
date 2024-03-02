const checkIpFraudRisk = async (ip) => {
    const url = `https://${Plugin.hostname}/${Plugin.username}/?ip=${ip}&key=${Plugin.key}&test=0`;
    const { json } = await Plugins.HttpGetJSON(url);

    let status = json.status;
    let error = json.error;

    let score = json.score;
    let risk = json.risk;

    if (status === 'error') {
        const text1 = `💥 ${error} 💥`;

        const message = `
        ${text1}`;

        Plugins.alert(
            'Error❗❗❗',
            message
        )
    } else {
        let scoreemoji = "🔢";
        let levelemoji = "🌟";
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

        Plugins.alert(
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
    if (!Plugin.hostname || !Plugin.username || !Plugin.key) {
        throw '请先【配置插件】'
    }
    await getip();
    const ip = await getip();
    await checkIpFraudRisk(ip);
};

const manual = async () => {
    if (!Plugin.hostname || !Plugin.username || !Plugin.key) {
        throw '请先【配置插件】'
    }
    const ip = await Plugins.prompt(
        '请输入需要查询的 IP 地址',
        '' /* 'initialValue' */,
        {
            placeholder: 'IP 地址，例如: 1.1.1.1'
        }
    );
    await checkIpFraudRisk(ip);
};
