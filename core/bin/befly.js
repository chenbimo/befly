#!/usr/bin/env node
// Befly CLI: 列出并执行 core/scripts 与 tpl/scripts 下的脚本

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

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

async function interactiveSelectAndRun(extraArgs = []) {
    const items = buildScriptItems();
    if (items.length === 0) {
        console.log('  • <无>');
        return 0;
    }

    let idx = 0;
    const draw = () => {
        process.stdout.write('\x1b[2J\x1b[0f'); // 清屏
        // 简短提示（不打印“可用脚本”）
        console.log('使用方向键选择，回车执行，q/ESC 退出');
        let lastName = '';
        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            const prefix = i === idx ? '›' : ' ';
            const label = it.source === 'tpl' && it.duplicate ? `${it.name}（重复 脚本）` : it.name;
            // 避免连续同名显示重复“核心+重复”挤在一起时不易读：仍各自一行，但保留顺序
            console.log(`${prefix} ${label}`);
            lastName = it.name;
        }
    };

    return await new Promise((resolve) => {
        const onData = (buf) => {
            const s = buf.toString('utf8');
            if (s === '\u0003') {
                // Ctrl+C
                cleanup();
                return resolve(130);
            }
            if (s === 'q' || s === 'Q' || s === '\u001b') {
                // q / ESC
                cleanup();
                return resolve(0);
            }
            if (s === '\r' || s === '\n') {
                const target = items[idx];
                cleanup();
                runScriptAtPath(target.path, target.name, extraArgs).then((code) => resolve(code));
                return;
            }
            // Arrow keys: \x1B[A up, \x1B[B down
            if (s === '\u001b[A') {
                idx = (idx - 1 + items.length) % items.length;
                draw();
                return;
            }
            if (s === '\u001b[B') {
                idx = (idx + 1) % items.length;
                draw();
                return;
            }
        };

        const cleanup = () => {
            try {
                process.stdin.setRawMode(false);
            } catch {}
            process.stdin.pause();
            process.stdin.off('data', onData);
        };

        draw();
        process.stdin.setRawMode && process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on('data', onData);
    });
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

function preferRunner() {
    // 优先 bun
    try {
        const which = process.platform === 'win32' ? 'where' : 'which';
        const res = spawnSync(which, ['bun'], { stdio: 'ignore' });
        if (res.status === 0) return 'bun';
    } catch {}
    // 回退到 node
    return process.execPath || 'node';
}

async function main() {
    const [, , cmd, ...args] = process.argv;

    if (!cmd || cmd === 'list' || cmd === '--list' || cmd === '-l') {
        // 若是交互终端且无明确 list 参数，提供方向键选择
        if (!cmd && process.stdin.isTTY && process.stdout.isTTY) {
            const code = await interactiveSelectAndRun([]);
            process.exit(code ?? 0);
        }
        printAllScripts();
        process.exit(0);
    }

    const target = resolveScriptPath(cmd);
    if (!target) {
        console.error(`未找到脚本: ${cmd}`);
        printAllScripts();
        process.exit(1);
    }

    // 正常按名称执行
    const code = await runScriptAtPath(target, cmd, args);
    process.exit(code ?? 0);
}

function runScriptAtPath(targetPath, label, args) {
    return new Promise((resolve) => {
        const runner = preferRunner();
        const isBun = runner === 'bun';
        const runArgs = isBun ? [targetPath, ...args] : [targetPath, ...args];
        console.log(`运行脚本: ${label} -> ${targetPath} (${runner})`);
        const child = spawn(runner, runArgs, { stdio: 'inherit' });
        child.on('close', (code) => resolve(code ?? 0));
    });
}

main().catch((e) => {
    console.error('Befly CLI 执行失败:', e);
    process.exit(1);
});
