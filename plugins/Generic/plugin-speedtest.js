const settingconfig = async () => {
    const configname = "plugin-speedtest-config";
    const configpath = "data/plugins/plugins-configs/" + configname + ".yaml";

    const mb = await Plugins.picker.single(
        "请选择下行速度测试文件大小",
        [
          { label: "5 MB", value: "5" },
          { label: "10 MB", value: "10" },
          { label: "20 MB", value: "20" },
          { label: "40 MB", value: "40" },
          { label: "100 MB", value: "100" },
          { label: "200 MB", value: "200" },
          { label: "0.5 GB", value: "512" },
          { label: "1 GB", value: "1024" },
        ],
        ["10"]
    );

    const code = `
mb: ${mb}
`;
    await Plugins.Writefile(configpath, code);
    Plugins.message.success("设置插件配置成功", 2_000);
};


const onRun = async () => {
    const starttime = Date.now();

    const configpath = './data/plugins/plugins-configs/plugin-speedtest-config.yaml';

    let fileExists = false;
    try {
        const yamlContent = await Plugins.Readfile(configpath);
        fileExists = true;
    } catch (error) {
        fileExists = false;
        // 文件不存在时执行的代码
        await settingconfig();
        Plugins.message.success("通过右键插件可重新设置", 6_000);
    };

    // 读取 YAML 文件
    const yamlContent = await Plugins.Readfile(configpath)

    // 解析 YAML 内容
    const yamlData = Plugins.YAML.parse(yamlContent)

    // 将 YAML 中的值赋给不同的变量
    const mb = yamlData.mb

    const bytes = mb * 1024 * 1024;
    const url = `https://speed.cloudflare.com/__down?bytes=${bytes}`;
    const path = './data/plugins/plugins-configs/speedtest';

    const pingurl = "http://connectivitycheck.gstatic.com/generate_204";

    const { id } = Plugins.message.info("延迟测试中，请稍后...", 200_000);

    let pingduration; // 在共同作用域内声明变量

    const pingstart = Date.now();

    try {
        await Plugins.HttpGet(pingurl);

        const pingend = Date.now();
        const pingDuration = (pingend - pingstart);

        if (pingDuration > 10000) {
            Exists = false;

            pingduration = "Error";
            Plugins.message.update(id, "延迟测试失败");
        } else {
            pingduration = pingDuration.toFixed(2)+ " ms  ";; // 保留两位小数

            Exists = true;
            Plugins.message.update(id, "延迟测试成功");
        };
    } catch (error) {
        Exists = false;

        pingduration = "Error";
        Plugins.message.destroy(arch);
        Plugins.message.update(id, "延迟测试失败");
    };

    await Plugins.sleep(1_000);
    Plugins.message.update(id, "下行速度测试中，请稍后...", 20000_000);

    let end;
    let speed;
    let duration;

    const start = Date.now();

    try {
        await Plugins.Download(url, path);
        end = Date.now();

        FileExists = true;
    } catch (error) {
        FileExists = false;

        speed = "Error";
        duration = "Error";

        Plugins.message.update(id, "下行速度测试失败", 1_000);
    };

    if (FileExists) {
        Plugins.message.update(id, "下行速度测试完成", 1_000);
            
        const Duration = (end - start) / 1000;
        const Speed = mb / Duration;
    
        duration = Duration.toFixed(2)+ " s  "; // 保留两位小数
        speed = Speed.toFixed(2)+ " MB/s  "; // 保留两位小数

        Plugins.Removefile(path);
    };

    await Plugins.sleep(1_000);
    Plugins.message.destroy(id);

    const endtime = Date.now();
    const Time = ((endtime - starttime) / 1000).toFixed(2)+ " s  "; // 保留两位小数

    const text0 = `⚡ 延迟: ${pingduration} `;
    const text1 = `💨 下行速度: ${speed} `;
    const text2 = `⏳ 测试耗时：${Time} `;

    const message = `
    ${text0}
    ${text1}
    ${text2}`;

    Plugins.confirm(
        '测速结果',
        message
    )
}
