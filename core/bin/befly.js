#!/usr/bin/env -S bun run
// Befly CLI (Bun): 列出并执行 core/scripts 与 tpl/scripts 下的脚本

import path from 'node:path';
import { Glob } from 'bun';

// 解析目录
const coreDir = path.resolve(import.meta.dir, '..');
const coreScriptsDir = path.resolve(coreDir, 'scripts');
// 用户项目（如 tpl）的脚本目录：始终基于当前工作目录
const tplScriptsDir = path.resolve(process.cwd(), 'scripts');

function safeList(dir) {
    try {
        // 使用 Bun.Glob 查找当前目录下的所有 .js 文件（不递归）
        const glob = new Glob('*.js');
        const files = Array.from(glob.scanSync({ cwd: dir, absolute: false, onlyFiles: true, dot: false }));
        return files.map((f) => path.basename(f, '.js')).sort();
    } catch {
        return [];
    }
}

function buildScriptItems() {
    const coreList = safeList(coreScriptsDir);
    const tplList = safeList(tplScriptsDir);
    const coreSet = new Set(coreList);

    const items = [];
    for (const name of coreList) {
        items.push({ name, source: 'core', duplicate: tplList.includes(name), path: path.resolve(coreScriptsDir, `${name}.js`) });
    }
    for (const name of tplList) {
        items.push({ name, source: 'tpl', duplicate: coreSet.has(name), path: path.resolve(tplScriptsDir, `${name}.js`) });
    }
    // 排序：名称字典序，core 在前
    items.sort((a, b) => (a.name === b.name ? (a.source === b.source ? 0 : a.source === 'core' ? -1 : 1) : a.name.localeCompare(b.name)));
    return items;
}

function printAllScripts() {
    const items = buildScriptItems();
    if (items.length === 0) {
        console.log('  • <无>');
        return;
    }
    for (const it of items) {
        if (it.source === 'tpl' && it.duplicate) console.log(`  • ${it.name}（重复）`);
        else console.log(`  • ${it.name}`);
    }
}

async function resolveScriptPath(name) {
    const base = name.endsWith('.js') ? name.slice(0, -3) : name;
    const filename = `${base}.js`;
    const corePath = path.resolve(coreScriptsDir, filename);
    const tplPath = path.resolve(tplScriptsDir, filename);
    if (await Bun.file(corePath).exists()) return corePath;
    if (await Bun.file(tplPath).exists()) return tplPath;
    // 回退到列表匹配（防止极端路径或大小写差异）
    const items = buildScriptItems();
    const hit = items.find((it) => it.name.toLowerCase() === base.toLowerCase() && it.source === 'core') || items.find((it) => it.name.toLowerCase() === base.toLowerCase());
    return hit ? hit.path : null;
}

async function runScriptAtPath(targetPath, label, args = []) {
    const bunExe = process.execPath || 'bun';
    console.log(`运行脚本: ${label} -> ${targetPath} (${bunExe})`);
    const child = Bun.spawn({ cmd: [bunExe, targetPath, ...args], stdio: ['inherit', 'inherit', 'inherit'] });
    const code = await child.exited;
    return code ?? 0;
}

async function main() {
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

main().catch((e) => {
    console.error('Befly CLI 执行失败:', e);
    process.exit(1);
});
