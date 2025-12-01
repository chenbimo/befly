/**
 * Befly 配置模块
 * 自动加载 befly.config.ts 并与默认配置合并
 */
import { scanConfig } from 'befly-shared/scanConfig';

import type { BeflyOptions } from './types/befly.js';

/** 默认配置 */
const defaultOptions: BeflyOptions = {
    // ========== 核心参数 ==========
    nodeEnv: (process.env.NODE_ENV as any) || 'development',
    appName: '野蜂飞舞',
    appPort: 3000,
    appHost: '127.0.0.1',
    devEmail: 'dev@qq.com',
    devPassword: 'beflydev123456',
    bodyLimit: 1048576, // 1MB
    tz: 'Asia/Shanghai',

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
        type: 'mysql',
        host: '127.0.0.1',
        port: 3306,
        username: 'root',
        password: 'root',
        database: 'befly_demo',
        poolMax: 10
    },

    // ========== Redis 配置 ==========
    redis: {
        host: '127.0.0.1',
        port: 6379,
        username: '',
        password: '',
        db: 0,
        prefix: 'befly_demo:'
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
    disableHooks: [],
    disablePlugins: [],

    // ========== Addon 配置 ==========
    addons: {}
};

/**
 * 合并配置（最多 2 级深度）
 */
function mergeConfig(defaults: BeflyOptions, userConfig: BeflyOptions): BeflyOptions {
    const result = { ...defaults };

    for (const key in userConfig) {
        const value = userConfig[key as keyof BeflyOptions];
        if (value !== undefined && value !== null) {
            if (typeof value === 'object' && !Array.isArray(value)) {
                result[key as keyof BeflyOptions] = {
                    ...(defaults[key as keyof BeflyOptions] as object),
                    ...value
                } as any;
            } else {
                result[key as keyof BeflyOptions] = value as any;
            }
        }
    }

    return result;
}

/**
 * 校验必要配置项
 */
function validateConfig(cfg: BeflyOptions): void {
    const requiredFields: (keyof BeflyOptions)[] = ['appName', 'appPort', 'appHost'];

    for (const field of requiredFields) {
        if (cfg[field] === undefined || cfg[field] === null) {
            throw new Error(`配置项 "${field}" 不能为空`);
        }
    }

    // 校验端口号范围
    if (typeof cfg.appPort !== 'number' || cfg.appPort < 1 || cfg.appPort > 65535) {
        throw new Error(`配置项 "appPort" 必须是 1-65535 之间的数字`);
    }

    // 校验数据库配置
    if (cfg.db) {
        if (!cfg.db.database) {
            throw new Error(`配置项 "db.database" 不能为空`);
        }
    }
}

// 加载项目配置（top-level await）
const projectConfig =
    (await scanConfig({
        dirs: [process.cwd()],
        files: ['befly.config']
    })) || {};

/**
 * 最终配置（默认配置 + 项目配置合并）
 * 可在任意模块中直接导入使用
 */
export const beflyConfig: BeflyOptions = mergeConfig(defaultOptions, projectConfig as BeflyOptions);

// 运行时校验配置
validateConfig(beflyConfig);
