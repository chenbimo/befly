/**
 * Befly 默认配置
 * 包含所有配置项的默认值
 */
import type { BeflyOptions } from './types/befly.js';

export const defaultOptions: Required<Omit<BeflyOptions, 'devPassword'>> = {
    // ========== 核心参数 ==========
    nodeEnv: 'development',
    appName: 'Befly',
    appPort: 3000,
    appHost: '127.0.0.1',
    devEmail: 'dev@qq.com',
    bodyLimit: 1048576, // 1MB
    tz: 'Asia/Shanghai',
    dbCache: 0,

    // ========== 日志配置 ==========
    logger: {
        debug: 1,
        excludeFields: 'password,token,secret',
        dir: './logs',
        console: 1,
        maxSize: 10485760 // 10MB
    },

    // ========== 数据库配置 ==========
    db: {
        enable: 0,
        type: 'sqlite',
        host: '127.0.0.1',
        port: 3306,
        username: 'root',
        password: '',
        database: 'befly',
        poolMax: 1
    },

    // ========== Redis 配置 ==========
    redis: {
        host: '127.0.0.1',
        port: 6379,
        username: '',
        password: '',
        db: 0,
        prefix: 'befly:'
    },

    // ========== 认证配置 ==========
    auth: {
        secret: 'befly-secret',
        expiresIn: '7d',
        algorithm: 'HS256'
    },

    // ========== CORS 配置 ==========
    cors: {
        origin: '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        allowedHeaders: 'Content-Type,Authorization',
        exposedHeaders: '',
        maxAge: 86400,
        credentials: 'true'
    },

    // ========== 禁用配置 ==========
    /** 禁用的钩子列表 */
    disableHooks: [],
    /** 禁用的插件列表 */
    disablePlugins: []
};
