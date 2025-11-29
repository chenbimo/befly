import type { MergeConfigOptions } from './configTypes.js';
/**
 * Addon 配置合并函数
 * 自动根据调用位置的 package.json 获取 addon 名称，然后加载项目 config 目录下的同名配置文件进行合并
 * @param options - 合并选项
 * @returns 合并后的配置对象
 * @example
 * ```ts
 * // 在 @befly-addon/admin 包中调用
 * const config = await addonConfigMerge();
 * // 自动读取：
 * // 1. @befly-addon/admin/package.json 的 befly 字段
 * // 2. 项目根目录/config/admin.{js,ts,json} 配置文件
 * // 3. 合并后返回
 * ```
 */
export declare function addonConfigMerge(options?: MergeConfigOptions): Promise<Record<string, any>>;
