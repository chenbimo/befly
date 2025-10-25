/**
 * 获取插件列表
 */

import { Yes } from 'befly';
import { scanAddons, getAddonDir } from '../../../../core/utils/helper.js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export default {
    name: '获取插件列表',
    auth: true,
    fields: {},
    handler: async (befly, ctx) => {
        // 扫描所有插件
        const addonNames = scanAddons();

        const addonList = [];

        for (const addonName of addonNames) {
            const addonDir = getAddonDir(addonName);
            const configPath = join(addonDir, 'addon.config.json');

            // 读取插件配置
            if (existsSync(configPath)) {
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
                    // 配置文件解析失败，使用默认值
                    addonList.push({
                        name: addonName,
                        title: addonName,
                        version: '1.0.0',
                        description: '',
                        enabled: true
                    });
                }
            } else {
                // 没有配置文件，使用默认值
                addonList.push({
                    name: addonName,
                    title: addonName,
                    version: '1.0.0',
                    description: '',
                    enabled: true
                });
            }
        }

        return Yes('获取成功', {
            lists: addonList
        });
    }
};
