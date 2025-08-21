#!/usr/bin/env node

/**
 * Befly CLI 工具
 * 提供命令行接口来执行 befly 框架的各种脚本
 */

import { spawn } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { __dirroot, __dirscript } from '../system.js';

// 使用 system.js 中定义的路径变量
const BEFLY_ROOT = __dirroot;
const SCRIPTS_DIR = __dirscript;

// 显示帮助信息
const showHelp = async () => {
    console.log(`
Befly CLI 工具 v2.0.12

用法:
  befly <script-name> [args...]

可用的脚本:
`);

    // 列出所有可用的脚本
    if (existsSync(SCRIPTS_DIR)) {
        try {
            const fileList = await readdir(SCRIPTS_DIR);
            const scripts = fileList
                .filter((file) => file.endsWith('.js'))
                .map((file) => file.replace('.js', ''))
                .sort();

            if (scripts.length > 0) {
                scripts.forEach((script) => {
                    console.log(`  befly ${script}`);
                });
            } else {
                console.log('  (没有找到可用的脚本)');
            }
        } catch (error) {
            console.log(`  (无法读取脚本目录: ${error.message})`);
        }
    } else {
        console.log('  (脚本目录不存在)');
    }

    console.log(`
选项:
  -h, --help               显示此帮助信息
  -v, --version            显示版本信息

更多信息请访问: https://chensuiyi.me
`);
};

// 显示版本信息
const showVersion = () => {
    try {
        const packageJsonPath = join(BEFLY_ROOT, 'package.json');
        if (existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
            console.log(`befly v${packageJson.version}`);
        } else {
            console.log('befly v2.0.12');
        }
    } catch (error) {
        console.log('befly v2.0.12');
    }
};

// 执行脚本
const runScript = (scriptName, args = []) => {
    // 检查脚本文件是否存在
    const scriptPath = join(SCRIPTS_DIR, `${scriptName}.js`);

    if (!existsSync(scriptPath)) {
        console.error(`❌ 错误: 脚本 '${scriptName}' 不存在`);
        console.error(`脚本路径: ${scriptPath}`);
        console.error('');
        console.error('运行 "befly --help" 查看可用的脚本列表');
        process.exit(1);
    }

    console.log(`🚀 执行脚本: ${scriptName}`);
    console.log(`📁 脚本路径: ${scriptPath}`);

    // 检测运行环境，优先使用 bun，回退到 node
    const isWindows = process.platform === 'win32';
    let runtime = 'bun';
    let runtimeArgs = ['run'];

    // 如果 bun 不可用，回退到 node
    const testBun = spawn(isWindows ? 'bun.exe' : 'bun', ['--version'], {
        stdio: 'ignore',
        shell: isWindows
    });

    testBun.on('error', () => {
        runtime = 'node';
        runtimeArgs = [];
    });

    testBun.on('close', (code) => {
        if (code !== 0) {
            runtime = 'node';
            runtimeArgs = [];
        }

        console.log(`⚡ 使用运行时: ${runtime}`);
        console.log('');

        // 执行脚本
        const child = spawn(isWindows ? `${runtime}.exe` : runtime, [...runtimeArgs, scriptPath, ...args], {
            stdio: 'inherit',
            shell: isWindows,
            cwd: process.cwd() // 使用调用者的工作目录
        });

        child.on('error', (error) => {
            console.error(`❌ 执行失败: ${error.message}`);
            process.exit(1);
        });

        child.on('close', (code) => {
            if (code !== 0) {
                console.error(`❌ 脚本执行失败，退出码: ${code}`);
                process.exit(code);
            } else {
                console.log(`✅ 脚本执行完成`);
            }
        });
    });
};

// 主函数
const main = async () => {
    const args = process.argv.slice(2);

    // 没有参数或请求帮助
    if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
        await showHelp();
        return;
    }

    // 显示版本
    if (args.includes('-v') || args.includes('--version')) {
        showVersion();
        return;
    }

    // 执行脚本
    const scriptName = args[0];
    const scriptArgs = args.slice(1);

    runScript(scriptName, scriptArgs);
};

// 错误处理
process.on('uncaughtException', (error) => {
    console.error('❌ 未捕获的异常:', error.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ 未处理的 Promise 拒绝:', reason);
    process.exit(1);
});

// 启动 CLI
main();
