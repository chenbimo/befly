import { existsSync } from 'node:fs';
import { join, dirname } from 'pathe';

import { mergeAndConcat } from 'merge-anything';

import { mergeConfig } from './mergeConfig.js';

import type { MergeConfigOptions } from './configTypes.js';

/**
 * Addon 配置合并函数
 * 自动根据调用位置的 package.json 获取 addon 名称，然后加载项目 config 目录下的同名配置文件进行合并
 * @param options - 合并选项
 * @returns 合并后的配置对象
 * @example
 * ```ts
 * // 在 @befly-addon/admin 包中调用
 * const config = await addonConfigMerge();
 * // 自动读取：
 * // 1. @befly-addon/admin/package.json 的 befly 字段
 * // 2. 项目根目录/config/admin.{js,ts,json} 配置文件
 * // 3. 合并后返回
 * ```
 */
export async function addonConfigMerge(options: MergeConfigOptions = {}): Promise<Record<string, any>> {
    try {
        // 1. 获取调用者的目录（addon 包根目录）
        const stack = new Error().stack || '';
        const callerLine = stack.split('\n')[2] || '';
        const match = callerLine.match(/\((.+?):\d+:\d+\)/) || callerLine.match(/at\s+(.+?):\d+:\d+/);

        if (!match) {
            throw new Error('无法确定调用者路径');
        }

        let callerPath = match[1].trim();

        // 处理 file:// 协议
        if (callerPath.startsWith('file://')) {
            callerPath = callerPath.replace('file://', '');
            // Windows 路径处理：file:///D:/path -> D:/path
            if (callerPath.startsWith('/') && callerPath[2] === ':') {
                callerPath = callerPath.substring(1);
            }
        }

        // 2. 获取调用者所在目录，并直接在当前目录查找 package.json
        const currentDir = dirname(callerPath);
        const packageJsonPath = join(currentDir, 'package.json');

        if (!existsSync(packageJsonPath)) {
            throw new Error(`未找到 package.json 文件: ${packageJsonPath}`);
        }

        // 3. 读取 package.json 获取 addon 配置
        const packageJson = await import(packageJsonPath, { with: { type: 'json' } });
        const addonConfig = packageJson.default?.befly || {};
        const addonName = packageJson.default?.name?.replace('@befly-addon/', '') || '';

        if (!addonName) {
            throw new Error('package.json 中未找到有效的 addon 名称');
        }

        // 4. 查找项目根目录（向上查找到 node_modules 的父级）
        let projectDir = currentDir;
        let maxDepth = 10;

        while (maxDepth-- > 0) {
            const parentDir = dirname(projectDir);
            if (parentDir.includes('node_modules')) {
                // 继续向上，直到跳出 node_modules
                projectDir = parentDir;
            } else {
                // 已经跳出 node_modules，找到项目根目录
                projectDir = parentDir;
                break;
            }
        }

        // 5. 检查项目 config 目录
        const projectConfigDir = join(projectDir, 'config');
        const configExists = existsSync(projectConfigDir);

        // 6. 如果项目没有 config 目录，直接返回 addon 配置
        if (!configExists) {
            return addonConfig;
        }

        // 7. 加载并合并配置
        const projectConfig = await mergeConfig({
            dirs: [projectConfigDir],
            files: [addonName],
            required: false
        });

        // 8. 如果项目没有对应配置文件，返回 addon 配置
        if (Object.keys(projectConfig).length === 0) {
            return addonConfig;
        }

        // 9. 合并 addon 配置和项目配置（项目配置优先级更高）
        return mergeAndConcat({}, addonConfig, projectConfig);
    } catch (error: any) {
        console.error('addonConfigMerge 失败:', error.message);
        return {};
    }
}
