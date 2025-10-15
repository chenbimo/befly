#!/usr/bin/env bun
/**
 * Befly CLI - TypeScript 版本
 * 列出并执行 core/scripts 与 tpl/scripts 下的脚本
 */

import path from 'node:path';
import { Glob } from 'bun';
import { __dirscript, getProjectDir } from '../system.js';

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

// 解析目录（来自 system.js）
// 核心脚本目录：core/scripts
const coreScriptsDir = __dirscript;
// 项目脚本目录：当前工作目录的 scripts
const projectScriptsDir = getProjectDir('scripts');
// Addons 脚本目录：当前工作目录的 addons/*/scripts
const projectAddonsDir = getProjectDir('addons');

/**
 * 安全地列出目录下的所有 .js/.ts 脚本文件
 * @param dir - 目录路径
 * @returns 脚本名称数组（不含扩展名）
 */
function safeList(dir: string): string[] {
    try {
        // 使用 Bun.Glob 查找当前目录下的所有 .js 和 .ts 文件（不递归）
        const glob = new Glob('*.{js,ts}');
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
                return basename.replace(/\.(js|ts)$/, '');
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
        const addonsDir = projectAddonsDir;
        if (!Bun.file(addonsDir).exists) {
            return results;
        }

        // 扫描 addons/*/scripts 目录
        const addonGlob = new Glob('*/scripts/*.{js,ts}');
        const addonFiles = Array.from(
            addonGlob.scanSync({
                cwd: addonsDir,
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
                const scriptName = path.basename(parts[2]).replace(/\.(js|ts)$/, '');
                const scriptPath = path.resolve(addonsDir, file);

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
    const coreList = safeList(coreScriptsDir);
    const projectList = safeList(projectScriptsDir);
    const addonScripts = scanAddonScripts();

    const items: ScriptItem[] = [];
    const nameSet = new Set<string>();

    // 添加核心脚本
    for (const name of coreList) {
        nameSet.add(name);
        items.push({
            name: name,
            source: 'core',
            displayName: name,
            duplicate: projectList.includes(name),
            path: path.resolve(coreScriptsDir, `${name}.ts`) // 优先 .ts
        });
    }

    // 添加项目脚本
    for (const name of projectList) {
        const isDup = nameSet.has(name);
        nameSet.add(name);
        items.push({
            name: name,
            source: 'project',
            displayName: name,
            duplicate: isDup,
            path: path.resolve(projectScriptsDir, `${name}.ts`) // 优先 .ts
        });
    }

    // 添加 addon 脚本（全部使用完整路径：addonName/scriptName）
    for (const addon of addonScripts) {
        const fullName = `${addon.addonName}/${addon.scriptName}`;
        items.push({
            name: fullName, // 使用完整名称作为唯一标识
            source: `addon:${addon.addonName}`,
            displayName: fullName,
            duplicate: false, // addon 脚本不参与重名检测
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
        console.log('\n📦 Core 脚本:');
        for (const it of coreScripts) {
            console.log(`  • ${it.displayName}${it.duplicate ? ' (重复)' : ''}`);
        }
    }

    if (projectScripts.length > 0) {
        console.log('\n📦 Project 脚本:');
        for (const it of projectScripts) {
            console.log(`  • ${it.displayName}${it.duplicate ? ' (重复)' : ''}`);
        }
    }

    if (addonScripts.length > 0) {
        console.log('\n📦 Addon 脚本 (必须使用完整路径):');
        for (const it of addonScripts) {
            console.log(`  • ${it.displayName}`);
        }
    }
}

/**
 * 解析脚本名称到完整路径
 * @param name - 脚本名称（可带或不带 .js/.ts 扩展名）
 *               addon 脚本必须使用完整格式：addonName/scriptName
 * @returns 脚本完整路径，未找到返回 null
 */
async function resolveScriptPath(name: string): Promise<string | null> {
    // 检查是否是 addon 格式：addonName/scriptName（必须使用完整路径）
    if (name.includes('/')) {
        const addonScripts = scanAddonScripts();
        const parts = name.split('/');
        if (parts.length === 2) {
            const [addonName, scriptName] = parts;
            const found = addonScripts.find(
                (a) => a.addonName === addonName && a.scriptName === scriptName.replace(/\.(js|ts)$/, '')
            );
            if (found) return found.scriptPath;
        }
        // 如果包含 / 但不是有效的 addon 格式，返回 null
        return null;
    }

    // 只在 core 和 project 中查找（addon 必须使用完整路径）
    const base = name.replace(/\.(js|ts)$/, '');

    // 检查 .ts 文件（优先）
    const coreTsPath = path.resolve(coreScriptsDir, `${base}.ts`);
    const projectTsPath = path.resolve(projectScriptsDir, `${base}.ts`);
    if (await Bun.file(coreTsPath).exists()) return coreTsPath;
    if (await Bun.file(projectTsPath).exists()) return projectTsPath;

    // 回退到 .js 文件
    const coreJsPath = path.resolve(coreScriptsDir, `${base}.js`);
    const projectJsPath = path.resolve(projectScriptsDir, `${base}.js`);
    if (await Bun.file(coreJsPath).exists()) return coreJsPath;
    if (await Bun.file(projectJsPath).exists()) return projectJsPath;

    // 回退到列表匹配（只匹配 core 和 project）
    const items = buildScriptItems();
    const hit = 
        items.find((it) => it.name.toLowerCase() === base.toLowerCase() && it.source === 'core') || 
        items.find((it) => it.name.toLowerCase() === base.toLowerCase() && it.source === 'project');

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
