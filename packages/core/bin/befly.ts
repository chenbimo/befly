#!/usr/bin/env bun
/**
 * Befly CLI - TypeScript 版本
 * 列出并执行 core/scripts 与 tpl/scripts 下的脚本
 */

import path from 'node:path';
import * as readline from 'node:readline';
import { Glob } from 'bun';
import { paths } from '../paths.js';

/**
 * 脚本项接口
 */
interface ScriptItem {
    /** 脚本名称 */
    name: string;
    /** 脚本来源 (core、tpl 或 addon 名称) */
    source: string;
    /** 如果是 addon，显示完整路径（如 admin/initDev） */
    displayName: string;
    /** 是否与另一来源的脚本重名 */
    duplicate: boolean;
    /** 脚本完整路径 */
    path: string;
}

/**
 * 命令行参数接口
 */
interface CliArgs {
    /** 是否为预演模式（只输出计划不执行） */
    DRY_RUN: boolean;
}

/**
 * 安全地列出目录下的所有 .ts 脚本文件
 * @param dir - 目录路径
 * @returns 脚本名称数组（不含扩展名）
 */
function safeList(dir: string): string[] {
    try {
        // 使用 Bun.Glob 查找当前目录下的所有 .ts 文件（不递归）
        const glob = new Glob('*.ts');
        const files = Array.from(
            glob.scanSync({
                cwd: dir,
                absolute: false,
                onlyFiles: true,
                dot: false
            })
        );
        // 移除扩展名并排序
        return files
            .map((f) => {
                const basename = path.basename(f);
                return basename.replace(/\.ts$/, '');
            })
            .sort();
    } catch {
        return [];
    }
}

/**
 * 扫描 addons 目录下所有组件的 scripts
 * @returns addon 脚本信息数组 { addonName, scriptName, scriptPath }
 */
function scanAddonScripts(): Array<{ addonName: string; scriptName: string; scriptPath: string }> {
    const results: Array<{ addonName: string; scriptName: string; scriptPath: string }> = [];

    try {
        // 检查 addons 目录是否存在
        if (!Bun.file(paths.projectAddonDir).exists) {
            return results;
        }

        // 扫描 addons/*/scripts 目录
        const addonGlob = new Glob('*/scripts/*.ts');
        const addonFiles = Array.from(
            addonGlob.scanSync({
                cwd: paths.projectAddonDir,
                absolute: false,
                onlyFiles: true,
                dot: false
            })
        );

        for (const file of addonFiles) {
            // 文件格式：addonName/scripts/scriptName.ts
            const parts = file.split(path.sep);
            if (parts.length === 3 && parts[1] === 'scripts') {
                const addonName = parts[0];
                const scriptName = path.basename(parts[2]).replace(/\.ts$/, '');
                const scriptPath = path.resolve(paths.projectAddonDir, file);

                results.push({
                    addonName,
                    scriptName,
                    scriptPath
                });
            }
        }
    } catch (error) {
        // 静默失败，返回空数组
    }

    return results;
}

/**
 * 构建所有可用脚本的列表
 * @returns 脚本项数组
 */
function buildScriptItems(): ScriptItem[] {
    const coreList = safeList(paths.rootScriptDir);
    const projectList = safeList(paths.projectScriptDir);
    const addonScripts = scanAddonScripts();

    const items: ScriptItem[] = [];

    // 添加核心脚本
    for (const name of coreList) {
        items.push({
            name: name,
            source: 'core',
            displayName: name,
            duplicate: false,
            path: path.resolve(paths.rootScriptDir, `${name}.ts`)
        });
    }

    // 添加项目脚本
    for (const name of projectList) {
        items.push({
            name: name,
            source: 'project',
            displayName: name,
            duplicate: false,
            path: path.resolve(paths.projectScriptDir, `${name}.ts`)
        });
    }

    // 添加 addon 脚本
    for (const addon of addonScripts) {
        items.push({
            name: addon.scriptName,
            source: `addon:${addon.addonName}`,
            displayName: addon.scriptName,
            duplicate: false,
            path: addon.scriptPath
        });
    }

    // 按来源分组排序：core > project > addon，同组内按名称字母序
    items.sort((a, b) => {
        // 按来源优先级排序
        const sourceOrder = { core: 1, project: 2 };
        const aOrder = sourceOrder[a.source as keyof typeof sourceOrder] || 3;
        const bOrder = sourceOrder[b.source as keyof typeof sourceOrder] || 3;

        if (aOrder !== bOrder) {
            return aOrder - bOrder;
        }

        // 同来源按名称字母序
        return a.displayName.localeCompare(b.displayName);
    });

    return items;
}

/**
 * 打印所有可用的脚本列表（带数字编号）
 * @param numbered - 是否显示数字编号（用于交互式选择）
 */
function printAllScripts(numbered: boolean = false): void {
    const items = buildScriptItems();
    if (items.length === 0) {
        console.log('  • <无>');
        return;
    }

    // 按来源分组显示
    const coreScripts = items.filter((it) => it.source === 'core');
    const projectScripts = items.filter((it) => it.source === 'project');
    const addonScripts = items.filter((it) => it.source.startsWith('addon:'));

    let index = 1;

    if (coreScripts.length > 0) {
        console.log('\n📦 内置脚本:');
        for (const it of coreScripts) {
            if (numbered) {
                console.log(`  ${index.toString().padStart(2, ' ')}. ${it.displayName}`);
                index++;
            } else {
                console.log(`  • ${it.displayName}`);
            }
        }
    }

    if (projectScripts.length > 0) {
        console.log('\n📦 项目脚本:');
        for (const it of projectScripts) {
            if (numbered) {
                console.log(`  ${index.toString().padStart(2, ' ')}. ${it.displayName}`);
                index++;
            } else {
                console.log(`  • ${it.displayName}`);
            }
        }
    }

    if (addonScripts.length > 0) {
        console.log('\n📦 组件脚本:');
        for (const it of addonScripts) {
            if (numbered) {
                console.log(`  ${index.toString().padStart(2, ' ')}. ${it.displayName}`);
                index++;
            } else {
                console.log(`  • ${it.displayName}`);
            }
        }
    }
}

/**
 * 交互式选择脚本
 * @returns 选中的脚本项，如果取消则返回 null
 */
async function interactiveSelect(): Promise<{ script: ScriptItem; args: string[] } | null> {
    const items = buildScriptItems();
    if (items.length === 0) {
        console.log('❌ 没有可用的脚本');
        return null;
    }

    console.log('\n🚀 Befly CLI - 脚本管理器\n');
    printAllScripts(true);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question('\n请输入脚本编号 (输入 0 或直接回车退出): ', (answer) => {
            const choice = parseInt(answer.trim());

            // 退出
            if (isNaN(choice) || choice === 0 || answer.trim() === '') {
                console.log('👋 已取消');
                rl.close();
                resolve(null);
                return;
            }

            // 验证选择
            if (choice < 1 || choice > items.length) {
                console.log(`❌ 无效的选择: ${choice}（请输入 1-${items.length}）`);
                rl.close();
                resolve(null);
                return;
            }

            const selected = items[choice - 1];
            console.log(`\n✅ 已选择: ${selected.displayName}`);

            rl.question('是否添加 --plan 参数? (y/n，直接回车默认为 n): ', (planAnswer) => {
                const addPlan = planAnswer.toLowerCase() === 'y' || planAnswer.toLowerCase() === 'yes';
                const args = addPlan ? ['--plan'] : [];

                rl.question('是否执行? (y/n，直接回车默认为 y): ', (confirmAnswer) => {
                    const shouldRun = confirmAnswer.toLowerCase() === 'y' || confirmAnswer.toLowerCase() === 'yes' || confirmAnswer.trim() === '';

                    rl.close();

                    if (!shouldRun) {
                        console.log('👋 已取消执行');
                        resolve(null);
                        return;
                    }

                    resolve({ script: selected, args });
                });
            });
        });
    });
}

/**
 * 在指定路径运行脚本
 * @param targetPath - 脚本完整路径
 * @param label - 脚本标签（用于日志）
 * @param args - 传递给脚本的参数
 * @returns 脚本退出码
 */
async function runScriptAtPath(targetPath: string, label: string, args: string[] = []): Promise<number> {
    const bunExe = process.execPath || 'bun';
    const child = Bun.spawn({
        cmd: [bunExe, targetPath, ...args],
        stdio: ['inherit', 'inherit', 'inherit'],
        cwd: process.cwd(),
        env: { ...process.env, LOG_TO_CONSOLE: '1' }
    });
    const code = await child.exited;
    return code ?? 0;
}

/**
 * CLI 主函数（仅交互模式）
 */
async function main(): Promise<void> {
    const result = await interactiveSelect();
    if (!result) {
        process.exit(0);
    }

    const { script, args: scriptArgs } = result;
    const argsInfo = scriptArgs.length > 0 ? ` (参数: ${scriptArgs.join(' ')})` : '';
    console.log(`\n🚀 正在执行: ${script.displayName}${argsInfo}\n`);
    const code = await runScriptAtPath(script.path, script.displayName, scriptArgs);
    process.exit(code ?? 0);
}

// 启动 CLI
main().catch((e: Error) => {
    console.error('Befly CLI 执行失败:', e);
    process.exit(1);
});
