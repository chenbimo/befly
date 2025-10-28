/**
 * 获取插件列表
 */

import { Yes, scanAddons, getAddonDir } from '../../util.js';
import { readFileSync } from 'node:fs';

export default {
    name: '获取插件列表',
    handler: async (befly, ctx) => {
        const addonList: Array<{ name: string; title: string; version: string; description: string; enabled: boolean }> = [];

        // 使用 scanAddons 扫描所有 addon
        const addonNames = scanAddons();

        for (const fullAddonName of addonNames) {
            // fullAddonName 格式: addon-admin, addon-demo 等
            const addonName = fullAddonName.replace('addon-', ''); // 移除 addon- 前缀

            // 读取插件配置文件
            const configPath = getAddonDir(fullAddonName, 'addon.config.json');

            try {
                const configContent = readFileSync(configPath, 'utf-8');
                const config = JSON.parse(configContent);

                addonList.push({
                    name: config.name || addonName,
                    title: config.title || addonName,
                    version: config.version || '1.0.0',
                    description: config.description || '',
                    enabled: true
                });
            } catch (error) {
                // 配置文件不存在或解析失败，使用默认值
                addonList.push({
                    name: addonName,
                    title: addonName,
                    version: '1.0.0',
                    description: '',
                    enabled: true
                });
            }
        }

        return Yes('获取成功', addonList);
    }
};
