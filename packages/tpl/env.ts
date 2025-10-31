/**
 * 项目环境变量配置
 * 这里的配置会覆盖 core/env.ts 中的默认配置
 */

import type { EnvConfig } from 'befly/types/env.js';

const isDev = process.env.NODE_ENV === 'development';

/**
 * 项目自定义配置
 * 只需要配置需要覆盖的字段
 */
export const Env: Partial<EnvConfig> = {
    // ========== 项目配置 ==========
    APP_NAME: isDev ? '野蜂飞舞开发环境' : '野蜂飞舞正式环境',
    APP_PORT: 3000,
    APP_HOST: '127.0.0.1',
    DEV_EMAIL: 'dev@qq.com',
    DEV_PASSWORD: '111111',

    // ========== 日志配置 ==========
    LOG_DEBUG: isDev ? 1 : 0,
    LOG_EXCLUDE_FIELDS: 'password,token',
    LOG_TO_CONSOLE: 1,

    // ========== 数据库配置 ==========
    DB_TYPE: 'mysql',
    DB_HOST: '127.0.0.1',
    DB_USER: 'root2',
    DB_PASS: 'root2',
    DB_NAME: 'test4',

    // ========== Redis 配置 ==========
    REDIS_HOST: '127.0.0.1',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: '',
    REDIS_DB: 0,
    REDIS_KEY_PREFIX: 'befly_demo',

    // ========== JWT 配置 ==========
    JWT_SECRET: isDev ? 'befly-jwt-dev' : 'befly-jwt-prod',
    JWT_EXPIRES_IN: '7d'
};
