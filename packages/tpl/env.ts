/**
 * 项目环境变量配置
 * 这里的配置会覆盖 core/env.ts 中的默认配置
 */

import type { EnvConfig } from 'befly/types/env.js';

/**
 * 项目自定义配置
 * 只需要配置需要覆盖的字段
 */
export const Env: Partial<EnvConfig> = {};
