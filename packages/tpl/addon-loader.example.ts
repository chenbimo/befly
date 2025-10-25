/**
 * Addon 配置读取示例
 * 演示如何读取和使用 addon.config.json
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { AddonConfig } from '../core/types/addon.js';

/**
 * 读取单个 Addon 配置
 */
export function loadAddonConfig(addonPath: string): AddonConfig | null {
    try {
        const configPath = join(addonPath, 'addon.config.json');
        const content = readFileSync(configPath, 'utf-8');
        const config: AddonConfig = JSON.parse(content);

        // 设置默认值
        return {
            enabled: true,
            version: '0.0.1',
            ...config
        };
    } catch (error) {
        console.warn(`无法读取配置: ${addonPath}`, error);
        return null;
    }
}

/**
 * 加载所有 Addon 配置
 */
export function loadAllAddonConfigs(addonsDir: string): Map<string, AddonConfig> {
    const configs = new Map<string, AddonConfig>();

    try {
        const dirs = readdirSync(addonsDir, { withFileTypes: true });

        for (const dir of dirs) {
            // 跳过非目录和特殊目录
            if (!dir.isDirectory() || dir.name.startsWith('.') || dir.name.startsWith('_')) {
                continue;
            }

            const addonPath = join(addonsDir, dir.name);
            const config = loadAddonConfig(addonPath);

            if (config) {
                configs.set(config.name, config);
            }
        }
    } catch (error) {
        console.error('加载 Addon 配置失败:', error);
    }

    return configs;
}

/**
 * 查找启用的 Addons
 */
export function getEnabledAddons(configs: Map<string, AddonConfig>): AddonConfig[] {
    return Array.from(configs.values()).filter((config) => config.enabled !== false);
}

/**
 * 按关键词搜索 Addons
 */
export function searchAddonsByKeyword(configs: Map<string, AddonConfig>, keyword: string): AddonConfig[] {
    return Array.from(configs.values()).filter((config) => config.keywords?.some((k) => k.toLowerCase().includes(keyword.toLowerCase())));
}

/**
 * 示例用法
 */
if (import.meta.main) {
    const addonsDir = join(import.meta.dir, 'addons');
    const configs = loadAllAddonConfigs(addonsDir);

    console.log(`\n📦 加载了 ${configs.size} 个 Addon:\n`);

    for (const [name, config] of configs) {
        console.log(`  - ${config.title} (${name}@${config.version})`);
        if (config.description) {
            console.log(`    ${config.description}`);
        }
        console.log();
    }

    // 查找启用的 Addons
    const enabled = getEnabledAddons(configs);
    console.log(`✅ 启用的 Addons: ${enabled.length} 个\n`);

    // 按关键词搜索
    const adminAddons = searchAddonsByKeyword(configs, 'admin');
    console.log(`🔍 包含 "admin" 关键词的 Addons: ${adminAddons.length} 个`);
    adminAddons.forEach((config) => console.log(`  - ${config.title}`));
}
