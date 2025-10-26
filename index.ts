import "dotenv/config";
import axios from "axios";
// 导入 TronWeb 库，用于与 Tron 区块链网络交互
import { TronWeb } from "tronweb";
// 导入文件系统相关函数：检查文件是否存在、创建目录、写入文件
import { existsSync, mkdirSync, writeFileSync } from "fs";
// 导入路径拼接函数
import { join } from "path";
// 导入 dayjs 库用于处理日期和时间
import dayjs from "dayjs";
// 导入 dayjs 的时区和相对时间插件
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import relativeTime from "dayjs/plugin/relativeTime";
import duration from "dayjs/plugin/duration";
import 'dayjs/locale/zh-cn';
dayjs.locale('zh-cn');
// 扩展 dayjs 功能，添加时区和相对时间支持
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.extend(duration);
dayjs.tz.setDefault("Asia/Shanghai");

import { stdout as log } from "single-line-log";

// 创建 TronWeb 实例，连接到 Tron 主网的公共 API 节点
const tb = new TronWeb({ fullHost: "https://api.trongrid.io" });
let dots = 0;
let matcheds = 0;

/**
 * 判断字符串尾部的数字是否为顺增的连号，且长度至少为5位
 * 例如：
 *   - "abc12345" -> true (12345 是顺增的)
 *   - "abc56789" -> true (56789 是顺增的)
 *   - "abc12346" -> false (不是顺增)
 *   - "abc1234" -> false (长度不足5位)
 * 
 * @param str - 需要检查的字符串
 * @returns 如果尾部数字是顺增连号且长度>=5则返回true，否则返回false
 */
function isIncreasingDigits(str: string): boolean {
    // 使用正则表达式匹配字符串末尾的连续数字（至少5位）
    const match = str.match(/\d{5,}$/);
    // 如果没有匹配到，说明末尾没有5位及以上的连续数字
    if (!match) return false;

    // 将匹配到的数字字符串拆分成数组，并转换为数字类型
    // 例如："12345" -> ['1','2','3','4','5'] -> [1,2,3,4,5]
    const digits = match[0].split('').map(Number);

    // 遍历数组，检查每个数字是否比前一个数字大1
    for (let i = 1; i < digits.length; i++) {
        const prev = digits[i - 1]; // 前一个数字
        const curr = digits[i];     // 当前数字

        // 如果前一个或当前数字不存在，或者当前数字不等于前一个数字+1
        // 则说明不是顺增序列，返回false
        if (prev === undefined || curr === undefined || curr !== prev + 1) {
            return false;
        }
    }

    // 所有数字都满足顺增条件，返回true
    return true;
};

// 使用立即执行的异步函数（IIFE）来运行主程序逻辑
async function main() {

    /**
     * 定义各种靓号匹配规则
     * 包含4种类型的靓号模式：
     * 1. 小写字母连号：地址末尾有5个及以上连续的小写字母（如：abcde、xyz等）
     * 2. 大写字母连号：地址末尾有5个及以上连续的大写字母（如：ABCDE、XYZ等）
     * 3. 数字连号：地址末尾有5个及以上连续的数字（如：12345、88888等）
     * 4. 数字顺增：地址末尾有5个及以上顺增的数字（如：12345、56789等）
     */
    const regexps = {
        // 匹配地址末尾5个及以上连续的小写字母
        小写字母连号: /([a-z])\1{4,}$/,
        // 匹配地址末尾5个及以上连续的大写字母
        大写字母连号: /([A-Z])\1{4,}$/,
        // 匹配地址末尾5个及以上连续的数字
        数字连号: /(\d)\1{4,}$/,
        // 使用函数判断地址末尾是否为顺增数字
        数字顺增: isIncreasingDigits,
        // 目标词组 whalepay
        whalepay: /whalepay$/i,
        // 目标词组 pddo
        pddo: /PDDO$/,
    };

    while (true) {
        // 让出事件循环，确保可以响应 Ctrl+C 等信号
        await new Promise(resolve => setImmediate(resolve));

        log(`⟳ 正在生成地址... 第 ${dots++} 次`);
        // 使用 TronWeb 创建一个新的 Tron 账户
        // 返回的账户对象包含私钥、公钥和地址信息
        const account = await tb.createAccount();

        // 获取账户的 Base58 格式地址（Tron 地址的标准格式）
        // 例如：TXyZ9KjRmN2bSvKLqP3wQxYzMnHc4Vu8tD
        const base58Address = account.address.base58;

        // 标记是否匹配到靓号规则
        let matched = false;
        // 记录匹配到的靓号类型
        let type: keyof typeof regexps | undefined = undefined;

        // 遍历所有的靓号匹配规则
        for (const [name, regexp] of Object.entries(regexps)) {
            // 判断当前规则是函数还是正则表达式
            if (typeof regexp === 'function') {
                // 如果是函数（如 isIncreasingDigits），直接调用函数进行判断
                if (regexp(base58Address)) {
                    matched = true;
                    type = name as keyof typeof regexps;
                }
            } else {
                // 如果是正则表达式，使用 test 方法进行匹配
                if (regexp.test(base58Address)) {
                    matched = true;
                    type = name as keyof typeof regexps;
                }
            }
        }
        // 如果匹配到靓号规则，则保存该账户信息
        if (matched && typeof type === "string") {
            matcheds++;
            // 在控制台输出匹配信息，方便实时查看程序运行状态
            console.log(`
✅ 匹配到 ${type}: ${base58Address}
`);

            // 构建保存地址的根目录路径：当前文件所在目录/address
            const dir = join(__dirname, 'address');
            // 检查根目录是否存在，不存在则创建
            if (!existsSync(dir)) {
                mkdirSync(dir);
            }

            // 构建按类型分类的子目录路径
            // 例如：./address/小写字母连号/ 或 ./address/数字顺增/
            const typeDir = join(dir, type);
            // 检查类型子目录是否存在，不存在则创建
            if (!existsSync(typeDir)) {
                mkdirSync(typeDir);
            }

            // 根据不同的靓号类型构建不同的文件名
            let filename = "";
            if (type !== "数字顺增") {
                // 对于非"数字顺增"类型，文件名格式为：长度+匹配内容_完整地址.json
                // 例如：5abcde_TXyZ9KjRmN2bSvKLabcde.json
                const match = base58Address.match(regexps[type] as RegExp);
                const matchStr = match ? match[0] : "";
                filename = `${matchStr.length}${matchStr}_${base58Address}.json`;
            } else {
                // 对于"数字顺增"类型，文件名格式为：完整地址.json
                // 因为顺增数字本身就很特殊，直接用地址命名即可
                filename = `${base58Address}.json`;
            }

            // 将账户信息（包含私钥、公钥、地址等）以 JSON 格式写入文件
            // 使用 JSON.stringify 的第三个参数 2 来格式化输出，便于阅读
            writeFileSync(join(typeDir, filename), JSON.stringify(account, null, 2));
            if (process.env.PUSH_URL) {
                await axios.post(process.env.PUSH_URL, {
                    address: base58Address,
                    account: JSON.stringify(account)
                }).catch((error) => {
                    console.error('推送地址失败:', error.message);
                });
            }
        }
    }
}

main();

// 注册进程事件 control+c 退出时的处理函数
process.on('SIGINT', () => {
    console.log(
        `
手动终止程序。

总运行时长: ${dayjs.duration(process.uptime() * 1000).humanize()}
总共生成地址次数: ${dots}
匹配到靓号次数: ${matcheds}`);
    process.exit(0);
});