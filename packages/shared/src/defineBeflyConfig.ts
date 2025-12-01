/**
 * Befly 配置定义函数
 * 提供类型提示，不做任何处理，直接返回配置对象
 */

/**
 * 定义 Befly 配置
 * 提供类型提示，不做任何处理，直接返回配置对象
 * @param config 配置对象
 * @returns 配置对象
 * @example
 * ```ts
 * // app.config.ts
 * import { defineBeflyConfig } from 'befly-shared/defineBeflyConfig';
 *
 * export default defineBeflyConfig({
 *     appName: '我的应用',
 *     appPort: 3000,
 *     addons: {
 *         admin: {
 *             email: { host: 'smtp.qq.com' }
 *         }
 *     }
 * });
 * ```
 */
export function defineBeflyConfig<T extends Record<string, any>>(config: T): T {
    return config;
}
