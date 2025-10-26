/**
 * Script 命令 - 列出并执行项目脚本
 */

import path from 'node:path';
import { existsSync } from 'node:fs';
import { Glob } from 'bun';
import inquirer from 'inquirer';
import { Logger } from '../utils/logger.js';

/**
 * 脚本项接口
 */
interface ScriptItem {
    /** 脚本名称 */
    name: string;
    /** 脚本来源 (core、project 或 addon 名称) */
    source: string;
    /** 显示名称 */
    displayName: string;
    /** 脚本完整路径 */
    path: string;
}

/**
 * 查找项目根目录（向上查找 package.json）
 */
function findProjectRoot(startDir: string = process.cwd()): string | null {
    let currentDir = startDir;
    const root = path.parse(currentDir).root;

    while (currentDir !== root) {
        const packagePath = path.join(currentDir, 'package.json');
        if (existsSync(packagePath)) {
            return currentDir;
        }
        currentDir = path.dirname(currentDir);
    }

    return null;
}

/**
 * 安全地列出目录下的所有 .ts 脚本文件
 */
function safeList(dir: string): string[] {
    try {
        if (!existsSync(dir)) {
            return [];
        }

        const glob = new Glob('*.ts');
        const files = Array.from(
            glob.scanSync({
                cwd: dir,
                absolute: false,
                onlyFiles: true,
                dot: false
            })
        );

        return files.map((f) => path.basename(f).replace(/\.ts$/, '')).sort();
    } catch {
        return [];
    }
}

/**
 * 扫描 addons 目录下所有组件的 scripts
 */
function scanAddonScripts(projectRoot: string): Array<{ addonName: string; scriptName: string; scriptPath: string }> {
    const results: Array<{ addonName: string; scriptName: string; scriptPath: string }> = [];

    try {
        const addonsDir = path.join(projectRoot, 'addons');
        if (!existsSync(addonsDir)) {
            return results;
        }

        const addonGlob = new Glob('*/scripts/*.ts');
        const addonFiles = Array.from(
            addonGlob.scanSync({
                cwd: addonsDir,
                absolute: false,
                onlyFiles: true,
                dot: false
            })
        );

        for (const file of addonFiles) {
            const parts = file.split(path.sep);
            if (parts.length === 3 && parts[1] === 'scripts') {
                const addonName = parts[0];
                const scriptName = path.basename(parts[2]).replace(/\.ts$/, '');
                const scriptPath = path.resolve(addonsDir, file);

                results.push({
                    addonName,
                    scriptName,
                    scriptPath
                });
            }
        }
    } catch {
        // 静默失败
    }

    return results;
}

/**
 * 构建所有可用脚本的列表
 */
function buildScriptItems(projectRoot: string): ScriptItem[] {
    const items: ScriptItem[] = [];

    // 项目脚本
    const projectScriptsDir = path.join(projectRoot, 'scripts');
    const projectList = safeList(projectScriptsDir);
    for (const name of projectList) {
        items.push({
            name,
            source: 'project',
            displayName: `[Project] ${name}`,
            path: path.resolve(projectScriptsDir, `${name}.ts`)
        });
    }

    // Addon 脚本
    const addonScripts = scanAddonScripts(projectRoot);
    for (const addon of addonScripts) {
        items.push({
            name: addon.scriptName,
            source: `addon:${addon.addonName}`,
            displayName: `[${addon.addonName}] ${addon.scriptName}`,
            path: addon.scriptPath
        });
    }

    return items;
}

/**
 * 运行脚本
 */
async function runScript(scriptPath: string, args: string[] = []): Promise<number> {
    const bunExe = process.execPath || 'bun';
    const child = Bun.spawn({
        cmd: [bunExe, scriptPath, ...args],
        stdio: ['inherit', 'inherit', 'inherit'],
        cwd: process.cwd(),
        env: { ...process.env }
    });

    const code = await child.exited;
    return code ?? 0;
}

/**
 * Script 命令处理函数
 */
export async function scriptCommand(options: { dryRun?: boolean; plan?: boolean } = {}) {
    try {
        // 查找项目根目录
        const projectRoot = findProjectRoot();
        if (!projectRoot) {
            Logger.error('未找到项目根目录（缺少 package.json）');
            process.exit(1);
        }

        // 构建脚本列表
        const items = buildScriptItems(projectRoot);

        if (items.length === 0) {
            Logger.warn('没有找到可用的脚本');
            process.exit(0);
        }

        // 使用 inquirer 选择脚本
        const { selectedScript } = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedScript',
                message: '请选择要执行的脚本:',
                choices: items.map((item) => ({
                    name: item.displayName,
                    value: item
                })),
                loop: false
            }
        ]);

        // 询问是否添加 --plan 参数
        let scriptArgs: string[] = [];
        if (options.plan !== false) {
            const { addPlan } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'addPlan',
                    message: '是否添加 --plan 参数（预演模式）?',
                    default: false
                }
            ]);

            if (addPlan) {
                scriptArgs.push('--plan');
            }
        }

        // 预演模式
        if (options.dryRun) {
            Logger.info(`[预演模式] 将执行: ${selectedScript.displayName}`);
            Logger.info(`[预演模式] 脚本路径: ${selectedScript.path}`);
            if (scriptArgs.length > 0) {
                Logger.info(`[预演模式] 参数: ${scriptArgs.join(' ')}`);
            }
            process.exit(0);
        }

        // 确认执行
        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: `确认执行 ${selectedScript.displayName}?`,
                default: true
            }
        ]);

        if (!confirm) {
            Logger.info('已取消执行');
            process.exit(0);
        }

        // 执行脚本
        const argsInfo = scriptArgs.length > 0 ? ` (参数: ${scriptArgs.join(' ')})` : '';
        Logger.info(`正在执行: ${selectedScript.displayName}${argsInfo}\n`);

        const exitCode = await runScript(selectedScript.path, scriptArgs);
        process.exit(exitCode);
    } catch (error) {
        if (error instanceof Error) {
            Logger.error(`执行失败: ${error.message}`);
        }
        process.exit(1);
    }
}
