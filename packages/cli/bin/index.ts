#!/usr/bin/env bun
/**
 * Befly CLI - 命令行工具入口
 */

import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { join } from 'pathe';
import { syncAllCommand } from '../commands/syncAll.js';
import { syncAdminCommand } from '../commands/syncAdmin.js';
import { initCommand } from '../commands/init.js';
import { Logger } from '../util.js';

const program = new Command();

// 读取版本号
const packageJson = JSON.parse(await readFile(join(import.meta.dir, '..', 'package.json'), 'utf-8'));

program.name('befly').description('Befly 框架命令行工具').version(packageJson.version, '-v, --version', '显示版本号');

// init 命令
program
    .command('init')
    .description('初始化项目')
    .option('-t, --template <type>', '选择项目模板 (admin|api)')
    .action(async (options) => {
        try {
            const template = options.template;

            if (!template || !['admin', 'api'].includes(template)) {
                Logger.error('请指定有效的模板类型');
                Logger.info('使用方法:');
                Logger.info('  befly init -t api      - 初始化后端项目');
                Logger.info('  befly init -t admin    - 初始化前端项目');
                process.exit(1);
            }

            await initCommand(template);
            process.exit(0);
        } catch (error: any) {
            Logger.error('命令执行失败:', error.message || error);
            process.exit(1);
        }
    });

// sync 命令
program
    .command('sync')
    .description('同步命令')
    .option('-t, --target <type>', '选择同步目标 (api|admin)')
    .action(async (options) => {
        Logger.printEnv();

        try {
            const target = options.target;

            if (!target || !['admin', 'api'].includes(target)) {
                Logger.error('请指定有效的同步目标');
                Logger.info('使用方法:');
                Logger.info('  befly sync -t api      - 同步后端');
                Logger.info('  befly sync -t admin    - 同步前端');
                process.exit(1);
            }

            if (target === 'admin') {
                await syncAdminCommand();
            } else {
                await syncAllCommand();
            }

            process.exit(0);
        } catch (error: any) {
            Logger.error('命令执行失败:', error.message || error);
            process.exit(1);
        }
    });

program.parse();
