/**
 * Befly CLI 环境启动器
 * 负责检测环境参数并在正确的环境中启动子进程
 *
 * 工作原理：
 * 1. 父进程：检测 --env 参数 → 启动子进程 → 退出
 * 2. 子进程：跳过启动逻辑 → 继续执行 CLI 命令
 */

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
    let envName = 'development'; // 默认环境

    if (envArgIndex !== -1 && process.argv[envArgIndex + 1]) {
        // 如果指定了 --env 参数
        envName = process.argv[envArgIndex + 1];
    } else if (process.env.NODE_ENV) {
        // 如果设置了 NODE_ENV 环境变量
        envName = process.env.NODE_ENV;
    }

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
