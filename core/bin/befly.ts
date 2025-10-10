#!/usr/bin/env -S bun run
/**
 * Befly CLI - TypeScript 版本
 * 列出并执行 core/scripts 与 tpl/scripts 下的脚本
 */

import path from 'node:path';
import { Glob } from 'bun';
import { __dirscript as coreScriptsDir, getProjectDir } from '../system.js';

/**
 * 脚本项接口
 */
interface ScriptItem {
    /** 脚本名称 */
    name: string;
    /** 脚本来源 (core 或 tpl) */
    source: 'core' | 'tpl';
    /** 是否与另一来源的脚本重名 */
    duplicate: boolean;
    /** 脚本完整路径 */
    path: string;
}

// 解析目录（来自 system.js）
// 核心脚本目录：core/scripts
// 用户项目（如 tpl）的脚本目录：始终基于当前工作目录
const tplScriptsDir = getProjectDir('scripts');

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
 * 构建所有可用脚本的列表
 * @returns 脚本项数组
 */
function buildScriptItems(): ScriptItem[] {
    const coreList = safeList(coreScriptsDir);
    const tplList = safeList(tplScriptsDir);
    const coreSet = new Set(coreList);

    const items: ScriptItem[] = [];

    // 添加核心脚本
    for (const name of coreList) {
        items.push({
            name: name,
            source: 'core',
            duplicate: tplList.includes(name),
            path: path.resolve(coreScriptsDir, `${name}.js`) // 优先 .js
        });
    }

    // 添加用户脚本
    for (const name of tplList) {
        items.push({
            name: name,
            source: 'tpl',
            duplicate: coreSet.has(name),
            path: path.resolve(tplScriptsDir, `${name}.js`) // 优先 .js
        });
    }

    // 排序：名称字典序，core 在前
    items.sort((a, b) => {
        if (a.name === b.name) {
            return a.source === b.source ? 0 : a.source === 'core' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
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
    for (const it of items) {
        if (it.source === 'tpl' && it.duplicate) {
            console.log(`  • ${it.name}（重复）`);
        } else {
            console.log(`  • ${it.name}`);
        }
    }
}

/**
 * 解析脚本名称到完整路径
 * @param name - 脚本名称（可带或不带 .js/.ts 扩展名）
 * @returns 脚本完整路径，未找到返回 null
 */
async function resolveScriptPath(name: string): Promise<string | null> {
    // 移除扩展名
    const base = name.replace(/\.(js|ts)$/, '');

    // 检查 .ts 文件（优先）
    const coreTsPath = path.resolve(coreScriptsDir, `${base}.ts`);
    const tplTsPath = path.resolve(tplScriptsDir, `${base}.ts`);
    if (await Bun.file(coreTsPath).exists()) return coreTsPath;
    if (await Bun.file(tplTsPath).exists()) return tplTsPath;

    // 回退到 .js 文件
    const coreJsPath = path.resolve(coreScriptsDir, `${base}.js`);
    const tplJsPath = path.resolve(tplScriptsDir, `${base}.js`);
    if (await Bun.file(coreJsPath).exists()) return coreJsPath;
    if (await Bun.file(tplJsPath).exists()) return tplJsPath;

    // 回退到列表匹配（防止极端路径或大小写差异）
    const items = buildScriptItems();
    const hit = items.find((it) => it.name.toLowerCase() === base.toLowerCase() && it.source === 'core') || items.find((it) => it.name.toLowerCase() === base.toLowerCase());

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
