import type { LoadConfigOptions } from './configTypes.js';
/**
 * 扫描并合并配置文件（矩阵搜索：dirs × files）
 * @param options - 加载选项
 * @returns 合并后的配置对象（或第一个找到的配置）
 */
export declare function scanConfig(options: LoadConfigOptions): Promise<Record<string, any>>;
