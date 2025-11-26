/**
 * 加载配置选项
 */
export interface LoadConfigOptions {
    /** 目录数组：要搜索的目录路径 */
    dirs: string[];
    /** 文件数组：要匹配的文件名 */
    files: string[];
    /** 是否必须找到至少一个配置文件，默认 false */
    required?: boolean;
    /** 文件扩展名，默认 ['.js', '.ts', '.json'] */
    extensions?: string[];
}

/**
 * Addon 配置合并选项（已废弃，仅用于向后兼容）
 */
export interface MergeConfigOptions {
    /** 合并策略（已废弃，始终使用 deep） */
    strategy?: 'deep' | 'shallow' | 'override';
    /** 是否克隆数据（已废弃） */
    clone?: boolean;
}
