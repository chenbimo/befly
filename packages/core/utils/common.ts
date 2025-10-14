/**
 * 通用工具函数
 * 存放不需要单独文件的简单辅助函数
 */

/**
 * 判断是否开启调试模式
 * @returns 是否开启调试模式
 *
 * 判断逻辑：
 * 1. DEBUG=1 或 DEBUG=true 时返回 true
 * 2. development 环境下默认返回 true（除非 DEBUG=0）
 * 3. 其他情况返回 false
 *
 * @example
 * // DEBUG=1
 * isDebug() // true
 *
 * // NODE_ENV=development
 * isDebug() // true
 *
 * // NODE_ENV=development, DEBUG=0
 * isDebug() // false
 *
 * // NODE_ENV=production
 * isDebug() // false
 */
export function isDebug(): boolean {
    return process.env.DEBUG === '1' || process.env.DEBUG === 'true' || (process.env.NODE_ENV === 'development' && process.env.DEBUG !== '0');
}
