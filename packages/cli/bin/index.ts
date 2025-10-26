#!/usr/bin/env bun
/**
 * Befly CLI - 命令行工具入口
 * 为 Befly 框架提供项目管理和脚本执行功能
 */

import { checkBunVersion } from '../utils/checkBun.js';

// 检查 Bun 版本
checkBunVersion();

import { Command } from 'commander';
import { initCommand } from '../commands/init.js';
import { scriptCommand } from '../commands/script.js';
import { devCommand } from '../commands/dev.js';
import { buildCommand } from '../commands/build.js';
import { startCommand } from '../commands/start.js';
import { syncCommand } from '../commands/sync.js';
import { addonCommand } from '../commands/addon.js';
import { Logger } from '../utils/logger.js';

const program = new Command();

program.name('befly').description('Befly CLI - 为 Befly 框架提供命令行工具').version('3.0.0');

// init 命令 - 初始化项目
program.command('init').description('初始化 Befly 项目').argument('[name]', '项目名称').option('-t, --template <type>', '项目模板 (befly-tpl/befly-admin)', 'befly-tpl').option('--skip-install', '跳过依赖安装', false).option('-f, --force', '强制覆盖已存在的目录', false).action(initCommand);

// script 命令 - 执行脚本
program.command('script').description('列出并执行 befly 脚本').option('--dry-run', '预演模式，只显示不执行', false).action(scriptCommand);

// dev 命令 - 开发服务器
program.command('dev').description('启动开发服务器').option('-p, --port <number>', '端口号', '3000').option('-h, --host <string>', '主机地址', '0.0.0.0').option('--no-sync', '跳过表同步', false).option('-v, --verbose', '详细日志', false).action(devCommand);

// build 命令 - 构建项目
program.command('build').description('构建项目').option('-o, --outdir <path>', '输出目录', 'dist').option('--minify', '压缩代码', false).option('--sourcemap', '生成 sourcemap', false).action(buildCommand);

// start 命令 - 启动生产服务器
program.command('start').description('启动生产服务器').option('-p, --port <number>', '端口号', '3000').option('-h, --host <string>', '主机地址', '0.0.0.0').action(startCommand);

// sync 命令 - 同步数据库
program.command('sync').description('同步数据库表结构').option('-t, --table <name>', '指定表名').option('-f, --force', '强制同步', false).option('--dry-run', '只显示 SQL 不执行', false).option('--drop', '删除不存在的表', false).action(syncCommand);

// addon 命令 - 插件管理
const addon = program.command('addon').description('管理 Befly 插件');

addon.command('install <name>').description('安装插件').option('-s, --source <url>', '插件源地址').action(addonCommand.install);

addon.command('uninstall <name>').description('卸载插件').option('--keep-data', '保留插件数据', false).action(addonCommand.uninstall);

addon.command('list').description('列出已安装的插件').action(addonCommand.list);

// 显示建议和错误
program.showSuggestionAfterError();
program.showHelpAfterError();

// 解析命令行参数
program.parse();
