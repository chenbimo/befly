import { merge } from 'merge-anything';
import type { UserConfig, Plugin } from 'vite';
import { createPlugins, pluginConfigs } from './plugins';
import { viteResolve, define } from './alias';
import { css } from './css';
import { server, logLevel } from './server';
import { build } from './build';
import { optimizeDeps } from './optimize';

/**
 * Befly 配置选项
 */
export interface BeflyConfigOptions extends Omit<UserConfig, 'plugins'> {
    /**
     * 插件配置覆盖
     * 只需指定要覆盖的插件参数，会自动与默认配置合并
     */
    pluginConfigs?: Partial<typeof pluginConfigs>;

    /**
     * 额外的插件
     * 会追加到默认插件列表之后
     */
    extraPlugins?: Plugin[];
}

/**
 * Befly Vite 默认配置
 */
export const defaultConfig: UserConfig = {
    plugins: createPlugins(),
    resolve: viteResolve,
    define: define,
    css: css,
    server: server,
    logLevel: logLevel,
    optimizeDeps: optimizeDeps,
    build: build
};

/**
 * 创建 Befly 配置
 * 将用户配置与默认配置深度合并
 *
 * @param options 用户自定义配置选项
 * @returns 合并后的完整配置
 *
 * @example
 * ```typescript
 * // 覆盖服务器端口
 * export default createBeflyConfig({
 *     server: { port: 3000 }
 * });
 *
 * // 覆盖 AutoImport 插件的 dirs 配置
 * export default createBeflyConfig({
 *     pluginConfigs: {
 *         autoImport: {
 *             dirs: ['./src/utils', './src/composables']
 *         }
 *     }
 * });
 *
 * // 覆盖 autoRoutes 的 debug 配置
 * export default createBeflyConfig({
 *     pluginConfigs: {
 *         autoRoutes: { debug: false }
 *     }
 * });
 *
 * // 添加额外插件
 * export default createBeflyConfig({
 *     extraPlugins: [myPlugin()]
 * });
 *
 * // 组合使用
 * export default createBeflyConfig({
 *     server: { port: 3000 },
 *     pluginConfigs: {
 *         autoImport: {
 *             dirs: ['./src/utils']
 *         }
 *     },
 *     extraPlugins: [myPlugin()]
 * });
 * ```
 */
export function createBeflyConfig(options: BeflyConfigOptions = {}): UserConfig {
    const { pluginConfigs: customPluginConfigs, extraPlugins, ...restOptions } = options;

    // 1. 深度合并插件配置
    const mergedPluginConfigs = customPluginConfigs ? merge(pluginConfigs, customPluginConfigs) : pluginConfigs;

    // 2. 创建合并后的插件列表
    const mergedPlugins = createPlugins(mergedPluginConfigs as any);

    // 3. 追加用户的额外插件
    if (extraPlugins && extraPlugins.length > 0) {
        mergedPlugins.push(...extraPlugins);
    }

    // 4. 合并其他配置
    const { plugins: _, ...restDefaultConfig } = defaultConfig;
    const finalConfig = merge(restDefaultConfig, restOptions) as UserConfig;

    // 5. 设置最终插件列表
    finalConfig.plugins = mergedPlugins;

    return finalConfig;
}
