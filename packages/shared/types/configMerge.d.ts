/**
 * 配置来源信息
 */
export interface ConfigSource {
    /** 配置文件路径 */
    filePath: string;
    /** 配置数据 */
    data: Record<string, any>;
}
/**
 * 合并配置选项
 */
export interface MergeConfigOptions {
    /** 合并策略：deep 深度合并（默认），shallow 浅合并，override 覆盖 */
    strategy?: 'deep' | 'shallow' | 'override';
    /** 是否克隆数据（避免引用污染），默认 true */
    clone?: boolean;
}
/**
 * 加载配置选项
 */
export interface LoadConfigOptions {
    /** 目录数组：要搜索的目录路径 */
    dirs: string[];
    /** 文件数组：要匹配的文件名 */
    files: string[];
    /** 合并选项 */
    merge?: MergeConfigOptions;
    /** 是否必须找到至少一个配置文件，默认 false */
    required?: boolean;
    /** 文件扩展名，默认 ['.js', '.ts', '.json'] */
    extensions?: string[];
}
/**
 * 合并多个配置对象
 * @param configs - 配置对象数组
 * @param options - 合并选项
 * @returns 合并后的配置对象
 */
export declare function mergeConfig(configs: Record<string, any>[], options?: MergeConfigOptions): Record<string, any>;
/**
 * 加载并合并配置文件（矩阵搜索：dirs × files）
 * @param options - 加载选项
 * @returns 合并后的配置对象和来源信息
 */
export declare function loadAndMergeConfig(options: LoadConfigOptions): Promise<{
    config: Record<string, any>;
    sources: ConfigSource[];
}>;
