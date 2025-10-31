/**
 * Addon 配置类型定义
 */

/**
 * Addon 作者信息
 */
export interface AddonAuthor {
    /** 作者名称 */
    name: string;
    /** 作者邮箱 */
    email?: string;
    /** 作者网站 */
    url?: string;
}

/**
 * Addon 配置
 */
export interface AddonConfig {
    /** Addon 唯一标识（小写、短横线或下划线），例如 "admin"、"demo" */
    name: string;

    /** Addon 人类可读名称，例如 "管理后台" */
    title: string;

    /** 版本号（语义化版本），例如 "1.0.0" */
    version?: string;

    /** 简短描述 */
    description?: string;

    /** 作者信息 */
    author?: AddonAuthor | string;

    /** 源码仓库链接 */
    repo?: string;

    /** 关键词（用于搜索和分类） */
    keywords?: string[];

    /** 主入口文件路径（相对于 addon 目录），例如 "index.ts" */
    entry?: string;

    /** 是否默认启用 */
    enabled?: boolean;

    /** 依赖的其他 addon 或核心包 */
    dependencies?: Record<string, string>;

    /** 许可证 */
    license?: string;
}
