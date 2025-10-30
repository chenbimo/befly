/**
 * Befly CLI 环境启动器
 * 负责检测环境参数并在正确的环境中启动子进程
 *
 * 工作原理：
 * 1. 父进程：检测 --env 参数 → 启动子进程 → 退出
 * 2. 子进程：跳过启动逻辑 → 继续执行 CLI 命令
 */

import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 解析环境名称
 * 支持前缀匹配（至少3个字符）
 *
 * @param input 用户输入的环境名称
 * @returns 完整的环境名称
 */
function resolveEnvName(input: string): string {
    // 如果输入少于3个字符，直接返回（不做匹配）
    if (input.length < 3) {
        return input;
    }

    // 获取项目根目录的所有 .env.* 文件
    const rootDir = process.cwd();
    let envFiles: string[] = [];

    try {
        const files = readdirSync(rootDir);
        envFiles = files.filter((file) => file.startsWith('.env.') && file !== '.env.example').map((file) => file.replace('.env.', ''));
    } catch (error) {
        // 读取失败时直接返回原始输入
        return input;
    }

    // 精确匹配
    if (envFiles.includes(input)) {
        return input;
    }

    // 前缀匹配
    const matches = envFiles.filter((env) => env.startsWith(input.toLowerCase()));

    if (matches.length === 1) {
        return matches[0];
    }

    if (matches.length > 1) {
        console.error(`❌ 环境名称 "${input}" 匹配到多个环境: ${matches.join(', ')}`);
        console.error('请使用更具体的名称');
        process.exit(1);
    }

    // 未匹配到，返回原始输入（让 Bun 处理文件不存在的情况）
    return input;
}

/**
 * 启动环境检测和子进程
 * 如果在父进程中，会启动子进程并退出（不返回）
 * 如果在子进程中，直接返回（继续执行）
 *
 * @param entryFile CLI 入口文件的绝对路径（通常是 bin/index.ts）
 */
export async function launch(entryFile: string): Promise<void> {
    // 如果已经在子进程中，直接返回
    if (process.env.BEFLY_SUBPROCESS) {
        return;
    }

    // 确定环境名称
    const envArgIndex = process.argv.indexOf('--env');
    let envInput = 'development'; // 默认环境

    if (envArgIndex !== -1 && process.argv[envArgIndex + 1]) {
        // 如果指定了 --env 参数
        envInput = process.argv[envArgIndex + 1];
    } else if (process.env.NODE_ENV) {
        // 如果设置了 NODE_ENV 环境变量
        envInput = process.env.NODE_ENV;
    }

    // 解析环境名称（支持前缀匹配）
    const envName = resolveEnvName(envInput);
    const envFile = `.env.${envName}`;

    // 过滤掉 --env 参数（已通过 --env-file 处理）
    const filteredArgs = process.argv.slice(2).filter((arg, i, arr) => {
        if (arg === '--env') return false;
        if (arr[i - 1] === '--env') return false;
        return true;
    });

    // 启动子进程，使用指定的环境文件
    const proc = Bun.spawn(['bun', 'run', `--env-file=${envFile}`, entryFile, ...filteredArgs], {
        cwd: process.cwd(),
        stdio: ['inherit', 'inherit', 'inherit'],
        env: {
            ...process.env,
            BEFLY_SUBPROCESS: '1', // 标记为子进程
            NODE_ENV: envName // 同时设置 NODE_ENV
        }
    });

    // 等待子进程结束并退出（父进程不会返回）
    process.exit(await proc.exited);
}
