/**
 * 环境变量配置
 * 根据 NODE_ENV 自动切换开发/生产环境配置
 * 项目可通过创建 env.ts 或 env.js 文件覆盖这些配置
 */

import { existsSync } from 'node:fs';
import type { EnvConfig } from './types/env.js';

const isProd = process.env.NODE_ENV === 'production';

/**
 * 核心默认配置
 * 使用三元运算符根据环境切换配置
 */
const coreEnv: EnvConfig = {
    // ========== 项目配置 ==========
    NODE_ENV: process.env.NODE_ENV || 'development',
    APP_NAME: isProd ? '野蜂飞舞正式环境' : '野蜂飞舞开发环境',
    APP_PORT: 3000,
    APP_HOST: '127.0.0.1',
    DEV_EMAIL: '',
    DEV_PASSWORD: '123456',
    BODY_LIMIT: 10 * 1024 * 1024, // 10MB
    DATABASE_ENABLE: 0,
    TZ: 'Asia/Shanghai',

    // ========== 日志配置 ==========
    LOG_DEBUG: 1,
    LOG_EXCLUDE_FIELDS: 'password,token,secret',
    LOG_DIR: './logs',
    LOG_TO_CONSOLE: 1,
    LOG_MAX_SIZE: 10 * 1024 * 1024, // 10MB

    // ========== 数据库配置 ==========
    DB_TYPE: 'mysql',
    DB_HOST: '127.0.0.1',
    DB_PORT: 3306,
    DB_USER: 'root',
    DB_PASS: 'root',
    DB_NAME: 'befly_demo',
    DB_POOL_MAX: 10,

    // ========== Redis 配置 ==========
    REDIS_HOST: '127.0.0.1',
    REDIS_PORT: 6379,
    REDIS_USERNAME: '',
    REDIS_PASSWORD: '',
    REDIS_DB: 0,
    REDIS_KEY_PREFIX: 'befly_demo',

    // ========== JWT 配置 ==========
    JWT_SECRET: 'befly-secret',
    JWT_EXPIRES_IN: '7d',
    JWT_ALGORITHM: 'HS256',

    // ========== CORS 配置 ==========
    CORS_ALLOWED_ORIGIN: '*',
    CORS_ALLOWED_METHODS: 'GET, POST, PUT, DELETE, OPTIONS',
    CORS_ALLOWED_HEADERS: 'Content-Type, Authorization, authorization, token',
    CORS_EXPOSE_HEADERS: 'Content-Range, X-Content-Range, Authorization, authorization, token',
    CORS_MAX_AGE: 86400,
    CORS_ALLOW_CREDENTIALS: 'true'
};

/**
 * 尝试加载项目级别的 env.ts 配置
 */
async function loadProjectEnv(): Promise<Partial<EnvConfig>> {
    try {
        // 尝试从项目根目录加载 env.ts 或 env.js
        const projectEnvPathTs = process.cwd() + '/env.ts';
        const projectEnvPathJs = process.cwd() + '/env.js';

        let projectEnvPath = '';
        if (existsSync(projectEnvPathTs)) {
            projectEnvPath = projectEnvPathTs;
        } else if (existsSync(projectEnvPathJs)) {
            projectEnvPath = projectEnvPathJs;
        }

        // 检查文件是否存在
        if (!projectEnvPath) {
            return {};
        }

        // 动态导入
        const module = await import(projectEnvPath);
        return module.Env || module.default || {};
    } catch (error) {
        // 项目没有自定义配置，使用核心默认配置
        return {};
    }
}

// 使用 top-level await 加载项目配置
const projectEnv = await loadProjectEnv();

/**
 * 合并配置：项目配置覆盖核心配置
 */
export const Env: EnvConfig = {
    ...coreEnv,
    ...projectEnv
};
