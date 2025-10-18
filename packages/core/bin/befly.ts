#!/usr/bin/env bun
/**
 * Befly CLI - TypeScript 版本
 * 列出并执行 core/scripts 与 tpl/scripts 下的脚本
 */

import path from 'node:path';
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
    const nameSet = new Set<string>();

    // 添加核心脚本（带 core: 前缀）
    for (const name of coreList) {
        const displayName = `core:${name}`;
        nameSet.add(displayName);
        items.push({
            name: displayName,
            source: 'core',
            displayName: displayName,
            duplicate: false, // core 脚本使用前缀，不会重名
            path: path.resolve(paths.rootScriptDir, `${name}.ts`)
        });
    }

    // 添加项目脚本（不带前缀）
    for (const name of projectList) {
        const isDup = nameSet.has(name);
        nameSet.add(name);
        items.push({
            name: name,
            source: 'project',
            displayName: name,
            duplicate: isDup,
            path: path.resolve(paths.projectScriptDir, `${name}.ts`)
        });
    }

    // 添加 addon 脚本（使用 addonName:scriptName 格式）
    for (const addon of addonScripts) {
        const fullName = `${addon.addonName}:${addon.scriptName}`;
        items.push({
            name: fullName,
            source: `addon:${addon.addonName}`,
            displayName: fullName,
            duplicate: false, // addon 脚本使用前缀，不会重名
            path: addon.scriptPath
        });
    }

    // 排序：名称字典序，core > project > addon
    items.sort((a, b) => {
        const aDisplay = a.displayName;
        const bDisplay = b.displayName;
        if (aDisplay === bDisplay) {
            if (a.source === 'core') return -1;
            if (b.source === 'core') return 1;
            if (a.source === 'project') return -1;
            if (b.source === 'project') return 1;
            return 0;
        }
        return aDisplay.localeCompare(bDisplay);
    });

    return items;
}

/**
 * 打印所有可用的脚本列表
 */
function printAllScripts(): void {
    const items = buildScriptItems();
    if (items.length === 0) {
        console.log('  • <无>');
        return;
    }

    // 按来源分组显示
    const coreScripts = items.filter((it) => it.source === 'core');
    const projectScripts = items.filter((it) => it.source === 'project');
    const addonScripts = items.filter((it) => it.source.startsWith('addon:'));

    if (coreScripts.length > 0) {
        console.log('\n📦 Core 脚本 (使用 core:scriptName 格式):');
        for (const it of coreScripts) {
            console.log(`  • ${it.displayName}`);
        }
    }

    if (projectScripts.length > 0) {
        console.log('\n📦 Project 脚本 (直接使用脚本名):');
        for (const it of projectScripts) {
            console.log(`  • ${it.displayName}${it.duplicate ? ' (与 core 重名，优先使用 project)' : ''}`);
        }
    }

    if (addonScripts.length > 0) {
        console.log('\n📦 Addon 脚本 (使用 addonName:scriptName 格式):');
        for (const it of addonScripts) {
            console.log(`  • ${it.displayName}`);
        }
    }
}

/**
 * 解析脚本名称到完整路径
 * @param name - 脚本名称
 *               - core 脚本：core:scriptName
 *               - addon 脚本：addonName:scriptName
 *               - project 脚本：scriptName（不带前缀）
 * @returns 脚本完整路径，未找到返回 null
 */
async function resolveScriptPath(name: string): Promise<string | null> {
    // 1. 检查是否是 core 脚本格式：core:scriptName
    if (name.startsWith('core:')) {
        const scriptName = name.substring(5); // 移除 "core:" 前缀
        const corePath = path.resolve(paths.rootScriptDir, `${scriptName}.ts`);
        if (await Bun.file(corePath).exists()) {
            return corePath;
        }
        return null;
    }

    // 2. 检查是否是 addon 格式：addonName:scriptName
    if (name.includes(':')) {
        const addonScripts = scanAddonScripts();
        const parts = name.split(':');
        if (parts.length === 2) {
            const [addonName, scriptName] = parts;
            const found = addonScripts.find((a) => a.addonName === addonName && a.scriptName === scriptName.replace(/\.ts$/, ''));
            if (found) return found.scriptPath;
        }
        // 如果包含 : 但不是有效的格式，返回 null
        return null;
    }

    // 3. 不带前缀，查找 project 脚本
    const base = name.replace(/\.ts$/, '');
    const projectPath = path.resolve(paths.projectScriptDir, `${base}.ts`);
    if (await Bun.file(projectPath).exists()) {
        return projectPath;
    }

    // 4. 回退到列表匹配（只匹配 project，不会匹配 core 和 addon）
    const items = buildScriptItems();
    const hit = items.find((it) => it.name.toLowerCase() === base.toLowerCase() && it.source === 'project');

    return hit ? hit.path : null;
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
 * CLI 主函数
 */
async function main(): Promise<void> {
    const [, , cmd, ...args] = process.argv;

    // 无参数：打印所有脚本
    if (!cmd) {
        printAllScripts();
        process.exit(0);
    }

    // 按名称执行（将剩余参数透传给脚本）
    const target = await resolveScriptPath(cmd);
    if (!target) {
        console.error(`未找到脚本: ${cmd}`);
        printAllScripts();
        process.exit(1);
    }

    const code = await runScriptAtPath(target, cmd, args);
    process.exit(code ?? 0);
}

// 启动 CLI
main().catch((e: Error) => {
    console.error('Befly CLI 执行失败:', e);
    process.exit(1);
});
