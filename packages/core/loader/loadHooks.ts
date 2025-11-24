/**
 * 钩子加载器
 * 负责扫描和初始化所有钩子（核心、组件、项目）
 */

import { existsSync } from 'node:fs';

import { camelCase } from 'es-toolkit/string';
import { scanFiles, scanAddons, getAddonDir } from 'befly-util';

import { Logger } from '../lib/logger.js';
import { coreHookDir, projectHookDir } from '../paths.js';
import { sortModules } from '../util.js';
import { importAndRegister } from './loadPlugins.js';

import type { Hook } from '../types/hook.js';

async function scanHooks(dir: string, type: 'core' | 'addon' | 'app', loadedNames: Set<string>, config?: Record<string, any>, addonName?: string): Promise<Hook[]> {
    if (!existsSync(dir)) return [];

    const files = await scanFiles(dir, '*.{ts,js}');
    return importAndRegister<Hook>(
        files,
        loadedNames,
        (fileName) => {
            const name = camelCase(fileName);
            if (type === 'core') return name;
            if (type === 'addon') return `addon_${camelCase(addonName!)}_${name}`;
            return `app_${name}`;
        },
        (fileName) => `${type === 'core' ? '核心' : type === 'addon' ? `组件${addonName}` : '项目'}钩子 ${fileName}`,
        config
    );
}

export async function loadHooks(befly: { hookLists: Hook[]; pluginsConfig?: Record<string, any> }): Promise<void> {
    try {
        const loadedNames = new Set<string>();
        const allHooks: Hook[] = [];

        // 1. 核心钩子
        allHooks.push(...(await scanHooks(coreHookDir, 'core', loadedNames, befly.pluginsConfig)));

        // 2. 组件钩子
        const addons = scanAddons();
        for (const addon of addons) {
            const dir = getAddonDir(addon, 'hooks');
            allHooks.push(...(await scanHooks(dir, 'addon', loadedNames, befly.pluginsConfig, addon)));
        }

        // 3. 项目钩子
        allHooks.push(...(await scanHooks(projectHookDir, 'app', loadedNames, befly.pluginsConfig)));

        // 4. 排序
        const sortedHooks = sortModules(allHooks);
        if (sortedHooks === false) {
            Logger.error('钩子依赖关系错误，请检查 after 属性');
            process.exit(1);
        }

        befly.hookLists.push(...sortedHooks);
    } catch (error: any) {
        Logger.error('加载钩子时发生错误', error);
        process.exit(1);
    }
}
