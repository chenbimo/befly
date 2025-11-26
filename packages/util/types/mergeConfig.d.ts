import type { LoadConfigOptions } from './configTypes.js';
/**
 * 加载并合并配置文件（矩阵搜索：dirs × files）
 * @param options - 加载选项
 * @returns 合并后的配置对象
 */
export declare function mergeConfig(options: LoadConfigOptions): Promise<Record<string, any>>;
