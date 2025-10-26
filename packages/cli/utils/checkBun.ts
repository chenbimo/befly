/**
 * 检查 Bun 版本
 */

import { Logger } from './logger.js';

const REQUIRED_BUN_VERSION = '1.3.0';

/**
 * 比较版本号
 * @returns 1: v1 > v2, 0: v1 === v2, -1: v1 < v2
 */
function compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const num1 = parts1[i] || 0;
        const num2 = parts2[i] || 0;

        if (num1 > num2) return 1;
        if (num1 < num2) return -1;
    }

    return 0;
}

/**
 * 获取 Bun 版本
 */
function getBunVersion(): string | null {
    try {
        // 使用 Bun.version 获取当前运行的 Bun 版本
        if (typeof Bun !== 'undefined' && Bun.version) {
            return Bun.version;
        }

        // 备用方案：执行 bun --version
        const proc = Bun.spawnSync(['bun', '--version'], {
            stdout: 'pipe',
            stderr: 'pipe'
        });

        if (proc.exitCode === 0) {
            const version = proc.stdout.toString().trim();
            return version;
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * 检查 Bun 是否安装以及版本是否满足要求
 */
export function checkBunVersion(): void {
    const currentVersion = getBunVersion();

    if (!currentVersion) {
        Logger.error('未检测到 Bun 运行时');
        Logger.info('\nBefly CLI 需要 Bun v1.3.0 或更高版本');
        Logger.info('请访问 https://bun.sh 安装 Bun\n');
        Logger.info('安装命令:');
        Logger.info('  Windows (PowerShell): powershell -c "irm bun.sh/install.ps1 | iex"');
        Logger.info('  macOS/Linux: curl -fsSL https://bun.sh/install | bash\n');
        process.exit(1);
    }

    const comparison = compareVersions(currentVersion, REQUIRED_BUN_VERSION);

    if (comparison < 0) {
        Logger.error(`Bun 版本过低: ${currentVersion}`);
        Logger.info(`\n需要 Bun v${REQUIRED_BUN_VERSION} 或更高版本`);
        Logger.info('请升级 Bun:\n');
        Logger.info('  bun upgrade\n');
        process.exit(1);
    }

    // 版本满足要求，静默通过
}
