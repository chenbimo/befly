/**
 * 终端颜色工具 - TypeScript 版本
 * 提供 ANSI 颜色和样式支持，自动检测终端颜色能力
 */

/**
 * 格式化函数类型
 */
type Formatter = (input: string | number) => string;

/**
 * 颜色工具接口
 */
interface ColorsInterface {
    /** 是否支持颜色 */
    isColorSupported: boolean;

    // 样式
    /** 重置所有样式 */
    reset: Formatter;
    /** 加粗 */
    bold: Formatter;
    /** 变暗 */
    dim: Formatter;
    /** 斜体 */
    italic: Formatter;
    /** 下划线 */
    underline: Formatter;
    /** 反色 */
    inverse: Formatter;
    /** 隐藏 */
    hidden: Formatter;
    /** 删除线 */
    strikethrough: Formatter;

    // 前景色（标准）
    black: Formatter;
    red: Formatter;
    green: Formatter;
    yellow: Formatter;
    blue: Formatter;
    magenta: Formatter;
    cyan: Formatter;
    white: Formatter;
    gray: Formatter;

    // 前景色（高亮）
    blackBright: Formatter;
    redBright: Formatter;
    greenBright: Formatter;
    yellowBright: Formatter;
    blueBright: Formatter;
    magentaBright: Formatter;
    cyanBright: Formatter;
    whiteBright: Formatter;

    // 背景色（标准）
    bgBlack: Formatter;
    bgRed: Formatter;
    bgGreen: Formatter;
    bgYellow: Formatter;
    bgBlue: Formatter;
    bgMagenta: Formatter;
    bgCyan: Formatter;
    bgWhite: Formatter;

    // 背景色（高亮）
    bgBlackBright: Formatter;
    bgRedBright: Formatter;
    bgGreenBright: Formatter;
    bgYellowBright: Formatter;
    bgBlueBright: Formatter;
    bgMagentaBright: Formatter;
    bgCyanBright: Formatter;
    bgWhiteBright: Formatter;

    // 语义化颜色（带图标）
    info: Formatter;
    success: Formatter;
    warn: Formatter;
    error: Formatter;
}

/**
 * 检测是否支持颜色
 */
const detectColorSupport = (): boolean => {
    const env = process.env || {};
    const argv = process.argv || [];

    // 明确禁用颜色
    if (env.NO_COLOR || argv.includes('--no-color')) {
        return false;
    }

    // 明确启用颜色
    if (env.FORCE_COLOR || argv.includes('--color')) {
        return true;
    }

    // 根据平台和终端环境判断
    return process.platform === 'win32' || (process.stdout?.isTTY && env.TERM !== 'dumb') || !!env.CI;
};

const isColorSupported = detectColorSupport();

const isColorSupported = detectColorSupport();

/**
 * 创建格式化函数
 * @param open - 开始 ANSI 码
 * @param close - 结束 ANSI 码
 * @param replace - 替换的 ANSI 码（用于嵌套）
 * @returns 格式化函数
 */
const formatter =
    (open: string, close: string, replace: string = open): Formatter =>
    (input: string | number): string => {
        const string = String(input);
        const index = string.indexOf(close, open.length);
        // 如果字符串中包含结束码，需要处理嵌套情况
        return ~index ? open + replaceClose(string, close, replace, index) + close : open + string + close;
    };

/**
 * 替换字符串中的结束码（处理嵌套颜色）
 * @param string - 原始字符串
 * @param close - 结束码
 * @param replace - 替换码
 * @param index - 起始索引
 * @returns 处理后的字符串
 */
const replaceClose = (string: string, close: string, replace: string, index: number): string => {
    let result = '';
    let cursor = 0;
    do {
        result += string.substring(cursor, index) + replace;
        cursor = index + close.length;
        index = string.indexOf(close, cursor);
    } while (~index);
    return result + string.substring(cursor);
};

/**
 * 创建颜色工具实例
 * @param enabled - 是否启用颜色
 * @returns 颜色工具对象
 */
const createColors = (enabled: boolean = isColorSupported): ColorsInterface => {
    // 如果禁用颜色，返回直接转字符串的函数
    const f = enabled ? formatter : (): Formatter => (input: string | number) => String(input);

    return {
        isColorSupported: enabled,

        // 样式 - https://en.wikipedia.org/wiki/ANSI_escape_code#SGR
        reset: f('\x1b[0m', '\x1b[0m'),
        bold: f('\x1b[1m', '\x1b[22m', '\x1b[22m\x1b[1m'),
        dim: f('\x1b[2m', '\x1b[22m', '\x1b[22m\x1b[2m'),
        italic: f('\x1b[3m', '\x1b[23m'),
        underline: f('\x1b[4m', '\x1b[24m'),
        inverse: f('\x1b[7m', '\x1b[27m'),
        hidden: f('\x1b[8m', '\x1b[28m'),
        strikethrough: f('\x1b[9m', '\x1b[29m'),

        // 前景色（标准） - 30-37
        black: f('\x1b[30m', '\x1b[39m'),
        red: f('\x1b[31m', '\x1b[39m'),
        green: f('\x1b[32m', '\x1b[39m'),
        yellow: f('\x1b[33m', '\x1b[39m'),
        blue: f('\x1b[34m', '\x1b[39m'),
        magenta: f('\x1b[35m', '\x1b[39m'),
        cyan: f('\x1b[36m', '\x1b[39m'),
        white: f('\x1b[37m', '\x1b[39m'),
        gray: f('\x1b[90m', '\x1b[39m'), // 实际上是 blackBright

        // 前景色（高亮） - 90-97
        blackBright: f('\x1b[90m', '\x1b[39m'),
        redBright: f('\x1b[91m', '\x1b[39m'),
        greenBright: f('\x1b[92m', '\x1b[39m'),
        yellowBright: f('\x1b[93m', '\x1b[39m'),
        blueBright: f('\x1b[94m', '\x1b[39m'),
        magentaBright: f('\x1b[95m', '\x1b[39m'),
        cyanBright: f('\x1b[96m', '\x1b[39m'),
        whiteBright: f('\x1b[97m', '\x1b[39m'),

        // 背景色（标准） - 40-47
        bgBlack: f('\x1b[40m', '\x1b[49m'),
        bgRed: f('\x1b[41m', '\x1b[49m'),
        bgGreen: f('\x1b[42m', '\x1b[49m'),
        bgYellow: f('\x1b[43m', '\x1b[49m'),
        bgBlue: f('\x1b[44m', '\x1b[49m'),
        bgMagenta: f('\x1b[45m', '\x1b[49m'),
        bgCyan: f('\x1b[46m', '\x1b[49m'),
        bgWhite: f('\x1b[47m', '\x1b[49m'),

        // 背景色（高亮） - 100-107
        bgBlackBright: f('\x1b[100m', '\x1b[49m'),
        bgRedBright: f('\x1b[101m', '\x1b[49m'),
        bgGreenBright: f('\x1b[102m', '\x1b[49m'),
        bgYellowBright: f('\x1b[103m', '\x1b[49m'),
        bgBlueBright: f('\x1b[104m', '\x1b[49m'),
        bgMagentaBright: f('\x1b[105m', '\x1b[49m'),
        bgCyanBright: f('\x1b[106m', '\x1b[49m'),
        bgWhiteBright: f('\x1b[107m', '\x1b[49m'),

        // 语义化颜色（函数形式，带图标前缀）
        info: (input: string | number) => f('\x1b[34m', '\x1b[39m')(`ℹ ${input}`),
        success: (input: string | number) => f('\x1b[32m', '\x1b[39m')(`✓ ${input}`),
        warn: (input: string | number) => f('\x1b[33m', '\x1b[39m')(`⚠ ${input}`),
        error: (input: string | number) => f('\x1b[31m', '\x1b[39m')(`✖ ${input}`)
    };
};

/**
 * 默认颜色工具实例
 */
export const Colors = createColors();

/**
 * 导出类型
 */
export type { ColorsInterface, Formatter };
