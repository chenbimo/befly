﻿/**
 * 环境变量配置
 * 根据 NODE_ENV 自动切换开发/生产环境配置
 * 项目可通过创建 env.ts 文件覆盖这些配置
 */

import { existsSync } from 'node:fs';
import type { EnvConfig } from './types/env.js';

const isDev = process.env.NODE_ENV === 'development';

/**
 * 核心默认配置
 * 使用三元运算符根据环境切换配置
 */
const coreEnv: EnvConfig = {
    // ========== 项目配置 ==========
    NODE_ENV: process.env.NODE_ENV || 'development',
    APP_NAME: isDev ? '野蜂飞舞开发环境' : '野蜂飞舞正式环境',
    APP_PORT: isDev ? 3000 : 3000,
    APP_HOST: isDev ? '0.0.0.0' : '127.0.0.1',
    DEV_EMAIL: 'dev@qq.com',
    DEV_PASSWORD: isDev ? '123456' : '',
    BODY_LIMIT: 10485760, // 10MB
    PARAMS_CHECK: isDev ? 'true' : 'false',

    // ========== 日志配置 ==========
    LOG_DEBUG: isDev ? 1 : 0,
    LOG_EXCLUDE_FIELDS: 'password,token,secret',
    LOG_DIR: './logs',
    LOG_TO_CONSOLE: 1,
    LOG_MAX_SIZE: 52428800, // 50MB

    // ========== 时区配置 ==========
    TZ: 'Asia/Shanghai',

    // ========== 数据库配置 ==========
    DB_ENABLE: 1,
    DB_TYPE: 'mysql',
    DB_HOST: isDev ? '127.0.0.1' : 'localhost',
    DB_PORT: 3306,
    DB_USER: 'root',
    DB_PASS: isDev ? '123456' : '',
    DB_NAME: isDev ? 'befly_dev' : 'befly',
    DB_DEBUG: isDev ? 1 : 0,
    DB_POOL_MAX: 10,

    // ========== Redis 配置 ==========
    REDIS_ENABLE: 1,
    REDIS_HOST: isDev ? '127.0.0.1' : 'localhost',
    REDIS_PORT: 6379,
    REDIS_USERNAME: '',
    REDIS_PASSWORD: isDev ? '' : '',
    REDIS_DB: 0,
    REDIS_KEY_PREFIX: isDev ? 'befly_dev' : 'befly-prod',

    // ========== JWT 配置 ==========
    JWT_SECRET: isDev ? 'befly-dev-secret' : 'befly-prod-secret',
    JWT_EXPIRES_IN: '7d',
    JWT_ALGORITHM: 'HS256',

    // ========== CORS 配置 ==========
    CORS_ALLOWED_ORIGIN: isDev ? '*' : '',
    CORS_ALLOWED_METHODS: 'GET, POST, PUT, DELETE, OPTIONS',
    CORS_ALLOWED_HEADERS: 'Content-Type, Authorization, authorization, token',
    CORS_EXPOSE_HEADERS: 'Content-Range, X-Content-Range, Authorization, authorization, token',
    CORS_MAX_AGE: 86400,
    CORS_ALLOW_CREDENTIALS: 'true',

    // ========== 邮件配置 ==========
    MAIL_HOST: '',
    MAIL_PORT: 587,
    MAIL_POOL: 'true',
    MAIL_SECURE: 'false',
    MAIL_USER: '',
    MAIL_PASS: '',
    MAIL_SENDER: '',
    MAIL_ADDRESS: ''
};

/**
 * 尝试加载项目级别的 env.ts 配置
 */
async function loadProjectEnv(): Promise<Partial<EnvConfig>> {
    try {
        // 尝试从项目根目录加载 env.ts
        const projectEnvPath = process.cwd() + '/env.ts';

        // 检查文件是否存在
        if (!existsSync(projectEnvPath)) {
            return {};
        }

        // 动态导入
        const module = await import(projectEnvPath);
        return module.default || module.Env || {};
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
