/**
 * Befly Vite 配置工具
 * 提供配置合并和默认配置导出
 */
export { createBeflyConfig, defaultConfig } from './config/merge';
export { pluginConfigs } from './config/plugins';
export type { BeflyConfigOptions } from './config/merge';
export type { UserConfig } from 'vite';
