/**
 * 环境变量配置接口
 */
export interface EnvConfig {
    // ========== 项目配置 ==========
    NODE_ENV: string;
    APP_NAME: string;
    APP_PORT: number;
    APP_HOST: string;
    DEV_EMAIL: string;
    DEV_PASSWORD: string;
    BODY_LIMIT: number;
    PARAMS_CHECK: string;

    // ========== 日志配置 ==========
    LOG_DEBUG: number;
    LOG_EXCLUDE_FIELDS: string;
    LOG_DIR: string;
    LOG_TO_CONSOLE: number;
    LOG_MAX_SIZE: number;

    // ========== 时区配置 ==========
    TZ: string;

    // ========== 数据库配置 ==========
    DB_ENABLE: number;
    DB_TYPE: string;
    DB_HOST: string;
    DB_PORT: number;
    DB_USER: string;
    DB_PASS: string;
    DB_NAME: string;
    DB_DEBUG: number;
    DB_POOL_MAX: number;

    // ========== Redis 配置 ==========
    REDIS_ENABLE: number;
    REDIS_HOST: string;
    REDIS_PORT: number;
    REDIS_USERNAME: string;
    REDIS_PASSWORD: string;
    REDIS_DB: number;
    REDIS_KEY_PREFIX: string;

    // ========== JWT 配置 ==========
    JWT_SECRET: string;
    JWT_EXPIRES_IN: string;
    JWT_ALGORITHM: string;

    // ========== CORS 配置 ==========
    CORS_ALLOWED_ORIGIN: string;
    CORS_ALLOWED_METHODS: string;
    CORS_ALLOWED_HEADERS: string;
    CORS_EXPOSE_HEADERS: string;
    CORS_MAX_AGE: number;
    CORS_ALLOW_CREDENTIALS: string;

    // ========== 邮件配置 ==========
    MAIL_HOST: string;
    MAIL_PORT: number;
    MAIL_POOL: string;
    MAIL_SECURE: string;
    MAIL_USER: string;
    MAIL_PASS: string;
    MAIL_SENDER: string;
    MAIL_ADDRESS: string;
}
