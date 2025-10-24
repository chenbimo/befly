/**
 * 环境变量配置 - TypeScript 版本
 * 类型化所有环境变量
 */

/**
 * 环境变量配置接口
 */
export interface EnvConfig {
    // ========== 项目配置 ==========
    /** 项目模式：development | production | test */
    NODE_ENV: string;
    /** 应用名称 */
    APP_NAME: string;
    /** MD5 加密盐 */
    MD5_SALT: string;
    /** 监听端口 */
    APP_PORT: number;
    /** 监听主机 */
    APP_HOST: string;
    /** 超级管理员密码 */
    DEV_PASSWORD: string;
    /** 请求体大小限制（字节） */
    BODY_LIMIT: number;
    /** 是否进行参数验证 */
    PARAMS_CHECK: string;

    // ========== 日志配置 ==========
    /** debug日志开关：0 | 1 */
    LOG_DEBUG: number;
    /** 日志排除字段（逗号分隔） */
    LOG_EXCLUDE_FIELDS: string;
    /** 日志目录 */
    LOG_DIR: string;
    /** 是否输出到控制台：0 | 1 */
    LOG_TO_CONSOLE: number;
    /** 日志文件最大大小（字节） */
    LOG_MAX_SIZE: number;

    // ========== 时区配置 ==========
    /** 时区：Asia/Shanghai */
    TZ: string;

    // ========== 数据库配置 ==========
    /** 是否启用数据库：0 | 1 */
    DB_ENABLE: number;
    /** 数据库类型：sqlite | mysql | postgresql */
    DB_TYPE: string;
    /** 数据库主机 */
    DB_HOST: string;
    /** 数据库端口 */
    DB_PORT: number;
    /** 数据库用户名 */
    DB_USER: string;
    /** 数据库密码 */
    DB_PASS: string;
    /** 数据库名称 */
    DB_NAME: string;
    /** 是否启用调试：0 | 1 */
    DB_DEBUG: number;
    /** 连接池最大连接数 */
    DB_POOL_MAX: number;

    // ========== Redis 配置 ==========
    /** 是否启用 Redis：0 | 1 */
    REDIS_ENABLE: number;
    /** Redis 主机 */
    REDIS_HOST: string;
    /** Redis 端口 */
    REDIS_PORT: number;
    /** Redis 用户名 */
    REDIS_USERNAME: string;
    /** Redis 密码 */
    REDIS_PASSWORD: string;
    /** Redis 数据库索引 */
    REDIS_DB: number;
    /** Redis 键前缀 */
    REDIS_KEY_PREFIX: string;

    // ========== JWT 配置 ==========
    /** JWT 密钥 */
    JWT_SECRET: string;
    /** JWT 过期时间：7d | 30d | 1h */
    JWT_EXPIRES_IN: string;
    /** JWT 算法：HS256 | HS384 | HS512 */
    JWT_ALGORITHM: string;

    // ========== CORS 配置 ==========
    /** 允许的来源 */
    ALLOWED_ORIGIN: string;
    /** 允许的方法 */
    ALLOWED_METHODS: string;
    /** 允许的头部 */
    ALLOWED_HEADERS: string;
    /** 暴露的头部 */
    EXPOSE_HEADERS: string;
    /** 预检请求缓存时间（秒） */
    MAX_AGE: number;
    /** 是否允许凭证 */
    ALLOW_CREDENTIALS: string;

    // ========== 邮件配置 ==========
    /** 邮件服务器主机 */
    MAIL_HOST: string;
    /** 邮件服务器端口 */
    MAIL_PORT: number;
    /** 是否使用连接池 */
    MAIL_POOL: string;
    /** 是否使用 SSL */
    MAIL_SECURE: string;
    /** 邮件用户名 */
    MAIL_USER: string;
    /** 邮件密码 */
    MAIL_PASS: string;
    /** 发件人名称 */
    MAIL_SENDER: string;
    /** 发件人地址 */
    MAIL_ADDRESS: string;

    // ========== 同步脚本配置 ==========
    /** 是否合并 ALTER 语句 */
    SYNC_MERGE_ALTER: string;
    /** 是否同步在线索引 */
    SYNC_ONLINE_INDEX: string;
    /** 是否禁止字段缩小 */
    SYNC_DISALLOW_SHRINK: string;
    /** 是否允许类型变更 */
    SYNC_ALLOW_TYPE_CHANGE: string;
}

/**
 * 获取环境变量值（带默认值）
 */
const getEnv = (key: string, defaultValue: string = ''): string => {
    return process.env[key] || defaultValue;
};

/**
 * 获取数字类型环境变量
 */
const getEnvNumber = (key: string, defaultValue: number = 0): number => {
    const value = process.env[key];
    return value ? Number(value) : defaultValue;
};

/**
 * 环境变量配置对象
 */
export const Env: EnvConfig = {
    // ========== 项目配置 ==========
    NODE_ENV: getEnv('NODE_ENV', 'development'),
    APP_NAME: getEnv('APP_NAME', 'befly'),
    MD5_SALT: getEnv('MD5_SALT', 'befly'),
    APP_PORT: getEnvNumber('APP_PORT', 3000),
    APP_HOST: getEnv('APP_HOST', '0.0.0.0'),
    DEV_PASSWORD: getEnv('DEV_PASSWORD', ''),
    BODY_LIMIT: getEnvNumber('BODY_LIMIT', 10485760), // 10MB
    PARAMS_CHECK: getEnv('PARAMS_CHECK', 'true'),

    // ========== 日志配置 ==========
    LOG_DEBUG: getEnvNumber('LOG_DEBUG', 0),
    LOG_EXCLUDE_FIELDS: getEnv('LOG_EXCLUDE_FIELDS', 'password,token,secret'),
    LOG_DIR: getEnv('LOG_DIR', './logs'),
    LOG_TO_CONSOLE: getEnvNumber('LOG_TO_CONSOLE', 1),
    LOG_MAX_SIZE: getEnvNumber('LOG_MAX_SIZE', 10485760), // 10MB

    // ========== 时区配置 ==========
    TZ: getEnv('TZ', 'Asia/Shanghai'),

    // ========== 数据库配置 ==========
    DB_ENABLE: getEnvNumber('DB_ENABLE', 1),
    DB_TYPE: getEnv('DB_TYPE', 'mysql'),
    DB_HOST: getEnv('DB_HOST', 'localhost'),
    DB_PORT: getEnvNumber('DB_PORT', 3306),
    DB_USER: getEnv('DB_USER', 'root'),
    DB_PASS: getEnv('DB_PASS', ''),
    DB_NAME: getEnv('DB_NAME', 'befly'),
    DB_DEBUG: getEnvNumber('DB_DEBUG', 0),
    DB_POOL_MAX: getEnvNumber('DB_POOL_MAX', 10),

    // ========== Redis 配置 ==========
    REDIS_ENABLE: getEnvNumber('REDIS_ENABLE', 1),
    REDIS_HOST: getEnv('REDIS_HOST', 'localhost'),
    REDIS_PORT: getEnvNumber('REDIS_PORT', 6379),
    REDIS_USERNAME: getEnv('REDIS_USERNAME', ''),
    REDIS_PASSWORD: getEnv('REDIS_PASSWORD', ''),
    REDIS_DB: getEnvNumber('REDIS_DB', 0),
    REDIS_KEY_PREFIX: getEnv('REDIS_KEY_PREFIX', 'befly'),

    // ========== JWT 配置 ==========
    JWT_SECRET: getEnv('JWT_SECRET', 'befly-secret'),
    JWT_EXPIRES_IN: getEnv('JWT_EXPIRES_IN', '7d'),
    JWT_ALGORITHM: getEnv('JWT_ALGORITHM', 'HS256'),

    // ========== CORS 配置 ==========
    ALLOWED_ORIGIN: getEnv('ALLOWED_ORIGIN', '*'),
    ALLOWED_METHODS: getEnv('ALLOWED_METHODS', 'GET, POST, PUT, DELETE, OPTIONS'),
    ALLOWED_HEADERS: getEnv('ALLOWED_HEADERS', 'Content-Type, Authorization, authorization, token'),
    EXPOSE_HEADERS: getEnv('EXPOSE_HEADERS', 'Content-Range, X-Content-Range, Authorization, authorization, token'),
    MAX_AGE: getEnvNumber('MAX_AGE', 86400),
    ALLOW_CREDENTIALS: getEnv('ALLOW_CREDENTIALS', 'true'),

    // ========== 邮件配置 ==========
    MAIL_HOST: getEnv('MAIL_HOST', ''),
    MAIL_PORT: getEnvNumber('MAIL_PORT', 587),
    MAIL_POOL: getEnv('MAIL_POOL', 'true'),
    MAIL_SECURE: getEnv('MAIL_SECURE', 'false'),
    MAIL_USER: getEnv('MAIL_USER', ''),
    MAIL_PASS: getEnv('MAIL_PASS', ''),
    MAIL_SENDER: getEnv('MAIL_SENDER', ''),
    MAIL_ADDRESS: getEnv('MAIL_ADDRESS', ''),

    // ========== 同步脚本配置 ==========
    SYNC_MERGE_ALTER: getEnv('SYNC_MERGE_ALTER', 'false'),
    SYNC_ONLINE_INDEX: getEnv('SYNC_ONLINE_INDEX', 'false'),
    SYNC_DISALLOW_SHRINK: getEnv('SYNC_DISALLOW_SHRINK', 'true'),
    SYNC_ALLOW_TYPE_CHANGE: getEnv('SYNC_ALLOW_TYPE_CHANGE', 'false')
};
