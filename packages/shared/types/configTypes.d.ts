/**
 * 加载配置选项
 */
export interface LoadConfigOptions {
    /** 当前工作目录，默认 process.cwd() */
    cwd?: string;
    /** 目录数组：要搜索的目录路径（相对于 cwd） */
    dirs: string[];
    /** 文件数组：要匹配的文件名 */
    files: string[];
    /** 文件扩展名，默认 ['.js', '.ts', '.json'] */
    extensions?: string[];
    /** 加载模式：'first' = 返回第一个找到的配置（默认），'all' = 合并所有配置 */
    mode?: 'all' | 'first';
    /** 指定要提取的字段路径数组，如 ['menus', 'database.host']，为空则返回完整对象 */
    paths?: string[];
    /** 默认配置对象，会与加载的配置合并 */
    defaults?: Record<string, any>;
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
