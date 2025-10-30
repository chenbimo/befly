#!/usr/bin/env bun
/**
 * Befly CLI - 命令行工具入口
 * 为 Befly 框架提供项目管理和脚本执行功能
 */

/**
 * 环境启动器
 * 必须在任何模块导入前执行
 * 父进程会在这里启动子进程并退出
 * 只有子进程会继续执行后面的代码
 */
import { launch } from './launcher.js';
await launch(import.meta.path);

/**
 * 以下代码只在子进程中执行
 * 此时环境变量已正确加载
 */
import { Command } from 'commander';
import { scriptCommand } from '../commands/script.js';
import { devCommand } from '../commands/dev.js';
import { buildCommand } from '../commands/build.js';
import { startCommand } from '../commands/start.js';
import { syncDbCommand } from '../commands/syncDb.js';
import { addonCommand } from '../commands/addon.js';
import { syncApiCommand } from '../commands/syncApi.js';
import { syncMenuCommand } from '../commands/syncMenu.js';
import { syncDevCommand } from '../commands/syncDev.js';
import { Logger } from '../lib/logger.js';

/**
 * Bun 版本要求
 */
const REQUIRED_BUN_VERSION = '1.3.0';

/**
 * 比较版本号
 */
function compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const num1 = parts1[i] || 0;
        const num2 = parts2[i] || 0;

        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
    }

    return 0;
}

/**
 * 获取 Bun 版本
 */
function getBunVersion(): string | null {
    try {
        if (typeof Bun !== 'undefined' && Bun.version) {
            return Bun.version;
        }

        const proc = Bun.spawnSync(['bun', '--version'], {
            stdout: 'pipe',
            stderr: 'pipe'
        });

        if (proc.exitCode === 0) {
            const version = proc.stdout.toString().trim();
            return version;
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * 检查 Bun 版本
 */
function checkBunVersion(): void {
    const currentVersion = getBunVersion();

    if (!currentVersion) {
        Logger.error('未检测到 Bun 运行时');
        Logger.info('\nBefly CLI 需要 Bun v1.3.0 或更高版本');
        Logger.info('请访问 https://bun.sh 安装 Bun\n');
        Logger.info('安装命令:');
        Logger.info('  Windows (PowerShell): powershell -c "irm bun.sh/install.ps1 | iex"');
        Logger.info('  macOS/Linux: curl -fsSL https://bun.sh/install | bash\n');
        process.exit(1);
    }

    const comparison = compareVersions(currentVersion, REQUIRED_BUN_VERSION);

    if (comparison < 0) {
        Logger.error(`Bun 版本过低: ${currentVersion}`);
        Logger.info(`\n需要 Bun v${REQUIRED_BUN_VERSION} 或更高版本`);
        Logger.info('请升级 Bun:\n');
        Logger.info('  bun upgrade\n');
        process.exit(1);
    }
}

// 检查 Bun 版本
checkBunVersion();

const program = new Command();

program.name('befly').description('Befly CLI - 为 Befly 框架提供命令行工具').version('3.0.0');

// script 命令 - 执行脚本
program.command('script').description('列出并执行 befly 脚本').option('--dry-run', '预演模式，只显示不执行', false).action(scriptCommand);

// dev 命令 - 开发服务器
program.command('dev').description('启动开发服务器').option('-p, --port <number>', '端口号', '3000').option('-h, --host <string>', '主机地址', '0.0.0.0').option('--no-sync', '跳过表同步', false).option('-v, --verbose', '详细日志', false).action(devCommand);

// build 命令 - 构建项目
program.command('build').description('构建项目').option('-o, --outdir <path>', '输出目录', 'dist').option('--minify', '压缩代码', false).option('--sourcemap', '生成 sourcemap', false).action(buildCommand);

// start 命令 - 启动生产服务器
program.command('start').description('启动生产服务器').option('-p, --port <number>', '端口号', '3000').option('-h, --host <string>', '主机地址', '0.0.0.0').option('-c, --cluster <instances>', '集群模式（数字或 max）').action(startCommand);

// syncDb 命令 - 同步数据库
program.command('syncDb').description('同步数据库表结构').option('-t, --table <name>', '指定表名').option('--dry-run', '预览模式，只显示不执行', false).option('-e, --env <environment>', '指定环境 (development, production, test)').action(syncDbCommand);

// syncApi 命令 - 同步 API 接口
program.command('syncApi').description('同步 API 接口到数据库').option('--plan', '计划模式，只显示不执行', false).option('-e, --env <environment>', '指定环境 (development, production, test)').action(syncApiCommand);

// syncMenu 命令 - 同步菜单
program.command('syncMenu').description('同步菜单配置到数据库').option('--plan', '计划模式，只显示不执行', false).option('-e, --env <environment>', '指定环境 (development, production, test)').action(syncMenuCommand);

// syncDev 命令 - 同步开发者账号
program.command('syncDev').description('同步开发者管理员账号').option('--plan', '计划模式，只显示不执行', false).option('-e, --env <environment>', '指定环境 (development, production, test)').action(syncDevCommand);

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
