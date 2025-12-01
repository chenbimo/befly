/**
 * Addon 配置定义函数
 * 用于定义 addon 的静态配置（如菜单）
 * 只能在 addon.config.js 文件中使用
 *
 * @param _metaDirname - import.meta.dirname（保留参数，便于未来扩展）
 * @param addonConfig - addon 配置对象
 * @returns addon 配置对象
 * @example
 * ```ts
 * // 在 packages/addonAdmin/addon.config.js 中
 * import { defineAddonConfig } from 'befly-shared/defineAddonConfig';
 *
 * export default defineAddonConfig(import.meta.dirname, {
 *     menus: [...]
 * });
 * ```
 */
export function defineAddonConfig(_metaDirname: string, addonConfig: Record<string, any> = {}): Record<string, any> {
    return addonConfig;
}
