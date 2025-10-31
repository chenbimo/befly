/**
 * 工具函数相关类型定义
 */

/**
 * 日期格式化类型
 */
export type DateFormat = 'YYYY-MM-DD' | 'YYYY-MM-DD HH:mm:ss' | 'HH:mm:ss' | 'YYYY/MM/DD' | 'MM-DD' | string;

/**
 * 颜色代码
 */
export type ColorCode = 'reset' | 'bright' | 'dim' | 'underscore' | 'blink' | 'reverse' | 'hidden' | 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white';

/**
 * 分页参数
 */
export interface PaginationParams {
    /** 页码（从 1 开始） */
    page?: number;
    /** 每页数量 */
    limit?: number;
}

/**
 * 分页结果
 */
export interface PaginationResult<T = any> {
    /** 数据列表 */
    list: T[];
    /** 总条数 */
    total: number;
    /** 当前页码 */
    page: number;
    /** 每页数量 */
    limit: number;
    /** 总页数 */
    pages: number;
    /** 是否有下一页 */
    hasNext: boolean;
    /** 是否有上一页 */
    hasPrev: boolean;
}

/**
 * 文件类型
 */
export type FileType = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';

/**
 * MIME 类型
 */
export type MimeType = string;

/**
 * 文件上传选项
 */
export interface FileUploadOptions {
    /** 允许的文件类型 */
    allowedTypes?: string[];
    /** 最大文件大小（字节） */
    maxSize?: number;
    /** 保存目录 */
    saveDir?: string;
    /** 文件名生成函数 */
    filename?: (originalName: string) => string;
}
