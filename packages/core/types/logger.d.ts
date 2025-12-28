/**
 * 日志相关类型定义
 */

/**
 * 日志级别
 */
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

/**
 * 日志配置
 */
export interface LoggerConfig {
    /** 是否开启调试模式 (0: 关闭, 1: 开启) @default 0 */
    debug?: number;
    /**
     * 需要在日志中脱敏/排除的字段（仅支持数组）
     * - 支持模糊匹配："token" 可命中 "accessToken" / "user_token" 等
     * - 支持后缀匹配："*Secret" 可命中 "mySecret" / "appSecret" 等
     * - 支持前缀匹配："auth*" 可命中 "authorization" 等
     * - 支持包含匹配："*token*" 可命中包含 token 的任意 key
     */
    excludeFields?: string[];
    /** 日志目录 @default './logs' */
    dir?: string;
    /** 是否输出到控制台 (0: 关闭, 1: 开启) @default 1 */
    console?: number;
    /** 单个日志文件最大大小 (MB) @default 10 */
    maxSize?: number;

    /**
     * 字符串最大长度（超过会被截断）
     * - 影响所有结构化字段中的 string（包括 db.debug 打印的 sqlPreview）
     * - 生产环境建议保持较小值；需要更完整 SQL 时可在开发环境调大
     * @default 100
     */
    maxStringLen?: number;

    /**
     * 数组最多保留的元素数量（超出部分丢弃）
     * - 仅影响结构化日志清洗（数组裁剪）
     * @default 100
     */
    maxArrayItems?: number;

    /**
     * 结构化日志清洗：最大清洗深度（非递归遍历的 depth 上限）
     * - 值越大，日志更“完整”，但 CPU/内存开销更高
     * - 建议：生产环境保持较小值（默认 3），开发环境可调大（例如 5）
     * @default 3
     */
    sanitizeDepth?: number;

    /**
     * 结构化日志清洗：最大遍历节点数（防止超大对象/数组导致性能抖动）
     * @default 500
     */
    sanitizeNodes?: number;

    /**
     * 结构化日志清洗：对象最多保留的 key 数（超出部分丢弃）
     * @default 100
     */
    sanitizeObjectKeys?: number;
}
