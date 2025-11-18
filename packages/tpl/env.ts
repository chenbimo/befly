/**
 * 项目环境变量配置
 * 这里的配置会覆盖 core/env.ts 中的默认配置
 */

import type { EnvConfig } from 'befly/types/env.js';

const isProd = process.env.NODE_ENV === 'production';

/**
 * 项目自定义配置
 * 只需要配置需要覆盖的字段
 */
export const Env: Partial<EnvConfig> = {
    // ========== 项目配置 ==========
    APP_NAME: isProd ? '野蜂飞舞正式环境' : '野蜂飞舞开发环境'
};
