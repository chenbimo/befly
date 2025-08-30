#!/usr/bin/env -S bun run
// Befly CLI (Bun): 列出并执行 core/scripts 与 tpl/scripts 下的脚本

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 解析目录
const coreDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(coreDir, '..');
const coreScriptsDir = path.resolve(coreDir, 'scripts');
const tplScriptsDir = path.resolve(repoRoot, 'tpl', 'scripts');

function safeList(dir) {
    try {
        return fs
            .readdirSync(dir, { withFileTypes: true })
            .filter((d) => d.isFile() && d.name.endsWith('.js'))
            .map((d) => path.basename(d.name, '.js'))
            .sort();
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
        if (it.source === 'tpl' && it.duplicate) console.log(`  • ${it.name}（重复 脚本）`);
        else console.log(`  • ${it.name}`);
    }
}

function resolveScriptPath(name) {
    const filename = name.endsWith('.js') ? name : `${name}.js`;
    const corePath = path.resolve(coreScriptsDir, filename);
    const tplPath = path.resolve(tplScriptsDir, filename);
    // 执行时 core > tpl 优先级
    if (fs.existsSync(corePath)) return corePath;
    if (fs.existsSync(tplPath)) return tplPath;
    return null;
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
    const target = resolveScriptPath(cmd);
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
