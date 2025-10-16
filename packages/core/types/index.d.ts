/**/**/**

 * Befly 核心类型定义

 * 统一导出所有类型，简化导入路径 * Befly 核心类型定义 * Befly 核心类型定义

 *

 * @example * 统一导出所有类型，简化导入路径 * 统一导出所有类型，简化导入路径

 * ```typescript

 * import type { ApiRoute, BeflyContext, Plugin } from 'befly/types'; * *

 * ```

 */ * @example * @example



// 基础类型 * ```typescript * ```typescript

export * from './common.js';

export * from './context.js'; * import type { ApiRoute, BeflyContext, Plugin } from 'befly/types'; * import type { ApiRoute, BeflyContext, Plugin } from 'befly/types';



// 核心功能类型 * ``` * ```

export * from './api.js';

export * from './befly.js'; */ */

export * from './plugin.js';



// 功能模块类型

export * from './database.js';// 基础类型// 基础类型

export * from './crypto.js';

export * from './jwt.js';export * from './common.js';export * from './common.js';

export * from './validator.js';

export * from './redis.js';export * from './context.js';export * from './context.js';

export * from './logger.js';

export * from './tool.js';


// 核心功能类型// 核心功能类型

export * from './api.js';export * from './api.js';

export * from './befly.js';export * from './befly.js';

export * from './plugin.js';export * from './plugin.js';



// 功能模块类型// 功能模块类型

export * from './database.js';export * from './database.js';

export * from './crypto.js';export * from './crypto.js';

export * from './jwt.js';export * from './jwt.js';

export * from './validator.js';export * from './validator.js';

export * from './redis.js';export * from './redis.js';

export * from './logger.js';export * from './logger.js';

export * from './tool.js';export * from './tool.js';



/**
 * API 请求上下文
 */
export interface RequestContext {
    /** 原始请求对象 */
    req: Request;
    /** 解析后的 URL */
    url: URL;
    /** 路径名 */
    pathname: string;
    /** 查询参数 */
    query: URLSearchParams;
    /** 请求体数据 */
    body: any;
    /** 请求头 */
    headers: Headers;
    /** 路由参数 */
    params?: Record<string, string>;
    /** JWT 载荷（认证后） */
    jwt?: JwtPayload;
}

/**
 * API 响应格式
 */
export interface ApiResponse<T = any> {
    /** 状态码：0=成功，1=失败 */
    code: 0 | 1;
    /** 提示信息 */
    msg: string;
    /** 响应数据 */
    data: T;
}

/**
 * API 处理函数
 */
export type ApiHandler = (befly: BeflyContext, ctx: RequestContext, req: Request) => Promise<ApiResponse>;

/**
 * API 路由定义
 */
export interface ApiRoute {
    /** HTTP 方法 */
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';
    /** 接口名称 */
    name: string;
    /** 认证要求：false=公开，true=需登录，['admin']=需特定角色 */
    auth: boolean | string[];
    /** 字段规则定义 */
    fields: Record<string, string>;
    /** 必填字段列表 */
    required: string[];
    /** 处理函数 */
    handler: ApiHandler;
}

/**
 * JWT 载荷
 */
export interface JwtPayload {
    /** 用户 ID */
    userId?: string;
    /** 用户名 */
    username?: string;
    /** 角色 */
    role?: string;
    /** 权限列表 */
    permissions?: string[];
    /** 签发时间 */
    iat?: number;
    /** 过期时间 */
    exp?: number;
    /** 主题 */
    sub?: string;
    /** 签发者 */
    iss?: string;
    /** 受众 */
    aud?: string;
    /** JWT ID */
    jti?: string;
    /** 生效时间 */
    nbf?: number;
    /** 其他自定义字段 */
    [key: string]: any;
}

/**
 * JWT 签名选项
 */
export interface JwtSignOptions {
    /** 密钥 */
    secret?: string;
    /** 算法 */
    algorithm?: string;
    /** 过期时间 */
    expiresIn?: string;
    /** 签发者 */
    issuer?: string;
    /** 受众 */
    audience?: string;
    /** 主题 */
    subject?: string;
    /** 生效时间 */
    notBefore?: string | number;
    /** JWT ID */
    jwtId?: string;
}

/**
 * Befly 应用上下文
 * 包含所有插件提供的功能
 */
export interface BeflyContext {
    /** 数据库管理器 */
    db: SqlHelper;
    /** Redis 助手 */
    redis: typeof RedisHelper;
    /** 日志记录器 */
    logger: typeof Logger;
    /** 数据处理工具 */
    tool: Tool;
    /** 自定义插件 */
    [key: string]: any;
}

/**
 * 插件定义
 */
export interface Plugin {
    /** 插件名称 */
    name?: string;
    /** 依赖的插件列表 */
    after?: string[];
    /** 初始化函数 */
    onInit?: (befly: BeflyContext) => Promise<any>;
}

/**
 * 服务器配置
 */
export interface ServerConfig {
    /** 服务名称 */
    name: string;
    /** 端口号 */
    port: number;
    /** 主机 */
    host?: string;
    /** 静态文件目录 */
    static?: string;
    /** 自定义插件 */
    plugins?: Plugin[];
}

/**
 * SQL 查询操作符
 */
export interface WhereOperator {
    /** 大于 */
    $gt?: number;
    /** 大于等于 */
    $gte?: number;
    /** 小于 */
    $lt?: number;
    /** 小于等于 */
    $lte?: number;
    /** 不等于 */
    $ne?: any;
    /** 不等于（$ne 的别名） */
    $not?: any;
    /** 在...之中 */
    $in?: any[];
    /** 不在...之中 */
    $nin?: any[];
    /** 不在...之中（$nin 的别名） */
    $notIn?: any[];
    /** LIKE 模糊匹配 */
    $like?: string;
    /** NOT LIKE 模糊匹配 */
    $notLike?: string;
    /** BETWEEN...AND 范围查询 */
    $between?: [any, any];
    /** NOT BETWEEN...AND 范围查询 */
    $notBetween?: [any, any];
    /** IS NULL 空值检查 */
    $null?: boolean;
    /** IS NOT NULL 非空检查 */
    $notNull?: boolean;
}

/**
 * WHERE 条件
 * 支持两种格式：
 * 1. 嵌套格式：{ age: { $gt: 18 } }
 * 2. 一级属性格式：{ 'age$gt': 18 }（推荐）
 */
export type WhereConditions = {
    /** 普通字段条件（支持一级属性格式：'field$operator'） */
    [field: string]:
        | string
        | number
        | boolean
        | null
        | any[] // 支持 $in、$nin 的数组值
        | WhereOperator // 支持嵌套格式
        | WhereConditions[]; // 支持 $or、$and 的数组值

    /** OR 逻辑操作符 */
    $or?: WhereConditions[];

    /** AND 逻辑操作符 */
    $and?: WhereConditions[];
};

/**
 * SQL 查询选项
 */
export interface QueryOptions {
    /** 表名 */
    table: string;
    /** 查询字段，默认 ['*'] */
    fields?: string[];
    /** WHERE 条件 */
    where?: WhereConditions;
    /** 排序，如 'id DESC' */
    orderBy?: string;
    /** 页码（从 1 开始） */
    page?: number;
    /** 每页数量 */
    limit?: number;
    /** 是否包含已删除数据 */
    includeDeleted?: boolean;
    /** 自定义 state 条件 */
    customState?: WhereConditions;
}

/**
 * 插入选项
 */
export interface InsertOptions {
    /** 表名 */
    table: string;
    /** 插入数据（ID、时间戳、state 会自动生成） */
    data: Record<string, any>;
}

/**
 * 更新选项
 */
export interface UpdateOptions {
    /** 表名 */
    table: string;
    /** 更新数据（updated_at 会自动更新） */
    data: Record<string, any>;
    /** WHERE 条件 */
    where: WhereConditions;
    /** 是否包含已删除数据，默认 false */
    includeDeleted?: boolean;
}

/**
 * 删除选项
 */
export interface DeleteOptions {
    /** 表名 */
    table: string;
    /** WHERE 条件 */
    where: WhereConditions;
}

/**
 * 列表查询结果
 */
export interface ListResult<T = any> {
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
}

/**
 * 事务回调函数
 */
export type TransactionCallback<T = any> = (trans: SqlHelper) => Promise<T>;

/**
 * SQL 查询对象
 */
export interface SqlQuery {
    /** SQL 语句 */
    sql: string;
    /** 参数列表 */
    params: any[];
}

/**
 * SQL 管理器接口
 */
export interface SqlHelper {
    /** 查询单条数据 */
    getOne<T = any>(options: QueryOptions): Promise<T | null>;
    /** 查询列表（带分页） */
    getList<T = any>(options: QueryOptions): Promise<ListResult<T>>;
    /** 查询所有数据 */
    getAll<T = any>(options: Omit<QueryOptions, 'page' | 'limit'>): Promise<T[]>;
    /** 插入数据 */
    insData(options: InsertOptions): Promise<number>;
    /** 更新数据 */
    updData(options: UpdateOptions): Promise<number>;
    /** 删除数据 */
    delData(options: DeleteOptions): Promise<number>;
    /** 执行事务 */
    trans<T = any>(callback: TransactionCallback<T>): Promise<T>;
    /** 执行原始 SQL */
    query(sql: string, params?: any[]): Promise<any>;
}

/**
 * Redis 助手接口
 */
export interface RedisHelper {
    /** 设置对象到 Redis */
    setObject<T = any>(key: string, obj: T, ttl?: number | null): Promise<string | null>;
    /** 从 Redis 获取对象 */
    getObject<T = any>(key: string): Promise<T | null>;
    /** 从 Redis 删除对象 */
    delObject(key: string): Promise<void>;
    /** 生成基于时间的唯一 ID */
    genTimeID(): Promise<number>;
    /** 设置字符串值 */
    setString(key: string, value: string, ttl?: number | null): Promise<string | null>;
    /** 获取字符串值 */
    getString(key: string): Promise<string | null>;
    /** 检查键是否存在 */
    exists(key: string): Promise<number>;
    /** 设置过期时间 */
    expire(key: string, seconds: number): Promise<number>;
    /** 获取剩余过期时间 */
    ttl(key: string): Promise<number>;
}

/**
 * 日志记录器接口
 */
export interface Logger {
    /** 记录信息日志 */
    info(message: string | object): void;
    /** 记录警告日志 */
    warn(message: string | object): void;
    /** 记录错误日志 */
    error(message: string | object): void;
    /** 记录调试日志 */
    debug(message: string | object): void;
}

/**
 * 工具类接口
 */
export interface Tool {
    /** 处理更新数据 */
    updData(data: Record<string, any>, now?: number): Promise<Record<string, any>>;
    /** 处理插入数据 */
    insData(data: Record<string, any> | Record<string, any>[], now?: number): Promise<Record<string, any> | Record<string, any>[]>;
    /** 处理删除数据 */
    delData(now?: number): Promise<Record<string, any>>;
    /** 批量生成 ID */
    genIds(count: number): Promise<number[]>;
    /** 清理数据对象 */
    cleanData(data: Record<string, any>, removeNull?: boolean, removeEmptyString?: boolean): Record<string, any>;
}

/**
 * 验证结果
 */
export interface ValidationResult {
    /** 是否有效 */
    valid: boolean;
    /** 处理后的值 */
    value: any;
    /** 错误列表 */
    errors: string[];
}

/**
 * 数据库类型
 */
export type DbType = 'mysql' | 'postgresql' | 'sqlite';

/**
 * 列信息
 */
export interface ColumnInfo {
    /** 列名 */
    name: string;
    /** 数据类型 */
    type: string;
    /** 是否可空 */
    nullable: boolean;
    /** 默认值 */
    default: any;
    /** 注释 */
    comment: string;
}

/**
 * 索引信息
 */
export interface IndexInfo {
    /** 索引名 */
    name: string;
    /** 列名 */
    column: string;
    /** 是否唯一 */
    unique: boolean;
}

/**
 * 同步统计
 */
export interface SyncStats {
    /** 创建的表数 */
    created: number;
    /** 修改的表数 */
    modified: number;
    /** 创建的索引数 */
    indexesCreated: number;
    /** 删除的索引数 */
    indexesDropped: number;
}
