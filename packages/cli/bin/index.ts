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
    .option('--admin', '初始化前端 admin 项目（befly-admin）')
    .option('--api', '初始化后端 API 项目（befly-tpl）')
    .action(async (options) => {
        try {
            if (options.admin) {
                await initCommand('admin');
            } else if (options.api) {
                await initCommand('api');
            } else {
                Logger.error('请指定初始化类型: --api 或 --admin');
                Logger.info('使用方法:');
                Logger.info('  befly init --api    - 初始化后端项目');
                Logger.info('  befly init --admin  - 初始化前端项目');
                process.exit(1);
            }
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
    .option('--api', '同步后端（数据库、API、菜单等）')
    .option('--admin', '同步前端 admin 模板')
    .action(async (options) => {
        Logger.printEnv();

        try {
            if (options.admin) {
                await syncAdminCommand();
            } else if (options.api) {
                await syncAllCommand();
            } else {
                Logger.error('请指定同步目标: --api 或 --admin');
                Logger.info('使用方法:');
                Logger.info('  befly sync --api    - 同步后端');
                Logger.info('  befly sync --admin  - 同步前端');
                process.exit(1);
            }
            process.exit(0);
        } catch (error: any) {
            Logger.error('命令执行失败:', error.message || error);
            process.exit(1);
        }
    });

program.parse();
