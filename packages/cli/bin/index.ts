#!/usr/bin/env bun
/**
 * Befly CLI - 命令行工具入口
 */

import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { join } from 'pathe';
import chalk from 'chalk';
import { syncAllCommand } from '../commands/syncAll.js';
import { listPluginsCommand } from '../commands/listPlugins.js';
import { Logger } from '../util.js';

const program = new Command();

// 读取版本号
const packageJson = JSON.parse(await readFile(join(import.meta.dir, '..', 'package.json'), 'utf-8'));

program.name('befly').description('Befly 框架命令行工具').version(packageJson.version, '-v, --version', '显示版本号');

// sync 命令
program
    .command('sync')
    .description('同步后端数据')
    .option('-f, --force', '允许强制执行危险变更（如长度收缩）')
    .action(async (options) => {
        Logger.printEnv();

        try {
            await syncAllCommand({ force: options.force || false });
            process.exit(0);
        } catch (error: any) {
            Logger.error('命令执行失败:', error.message || error);
            process.exit(1);
        }
    });

// plugin list 命令
program
    .command('plugin list')
    .description('列出当前项目加载的所有插件')
    .action(async () => {
        try {
            await listPluginsCommand();
        } catch (error: any) {
            Logger.error('命令执行失败:', error.message || error);
            process.exit(1);
        }
    });

program.parse();
