/**
 * Addon 命令 - 插件管理
 */

import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Logger } from '../utils/logger.js';
import { Spinner } from '../lib/spinner.js';

export const addonCommand = {
    async install(name: string, options: { source?: string }) {
        const spinner = Spinner.start(`正在安装插件: ${name}`);

        try {
            // TODO: 实现插件安装逻辑
            // 1. 从 source 或默认源下载插件
            // 2. 解压到 addons 目录
            // 3. 安装插件依赖
            // 4. 执行插件安装脚本

            spinner.warn(`插件安装功能开发中`);
        } catch (error) {
            spinner.fail(`插件 ${name} 安装失败`);
            throw error;
        }
    },

    async uninstall(name: string, options: { keepData: boolean }) {
        const spinner = Spinner.start(`正在卸载插件: ${name}`);

        try {
            // TODO: 实现插件卸载逻辑
            // 1. 执行插件卸载脚本
            // 2. 删除插件文件
            // 3. 可选：删除插件数据

            spinner.warn(`插件卸载功能开发中`);
        } catch (error) {
            spinner.fail(`插件 ${name} 卸载失败`);
            throw error;
        }
    },

    async list() {
        // TODO: 读取已安装的插件列表
        console.log('已安装的插件:\n');
        console.log('(功能开发中)');
    }
};
