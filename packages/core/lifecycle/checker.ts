/**
 * 系统检查管理器
 * 负责在框架启动前执行系统检查
 */

import { join, basename } from 'pathe';
import { Logger } from '../lib/logger.js';
import { calcPerfTime } from '../util.js';
import { coreCheckDir } from '../paths.js';
import { scanAddons, getAddonDir, addonDirExists } from '../util.js';

/**
 * 系统检查器类
 */
export class Checker {
    /**
     * 执行所有系统检查
     */
    static async run(): Promise<void> {
        try {
            const checkStartTime = Bun.nanoseconds();

            const glob = new Bun.Glob('*.{ts}');

            // 统计信息
            const stats = {
                totalChecks: 0,
                passedChecks: 0,
                failedChecks: 0
            };

            // 1. 优先执行资源冲突检测（如果存在）
            try {
                const conflictCheckPath = join(coreCheckDir, 'conflict.ts');
                const conflictCheckFile = Bun.file(conflictCheckPath);

                if (await conflictCheckFile.exists()) {
                    stats.totalChecks++;
                    const conflictCheckStart = Bun.nanoseconds();

                    const conflictModule = await import(conflictCheckPath);
                    const conflictCheckFn = conflictModule.default;

                    if (typeof conflictCheckFn === 'function') {
                        const conflictResult = await conflictCheckFn();
                        const conflictCheckTime = calcPerfTime(conflictCheckStart);

                        if (typeof conflictResult !== 'boolean') {
                            Logger.warn(`核心检查 conflict.ts 返回值必须为 true 或 false，当前为 ${typeof conflictResult}`);
                            stats.failedChecks++;
                        } else if (conflictResult === true) {
                            stats.passedChecks++;
                        } else {
                            Logger.warn(`核心检查未通过: conflict.ts`);
                            stats.failedChecks++;
                            // 资源冲突检测失败，立即终止
                            Logger.warn('资源冲突检测失败，无法继续启动');
                            process.exit(1);
                        }
                    }
                }
            } catch (error: any) {
                Logger.error('执行资源冲突检测时出错:', error);
                stats.failedChecks++;
            }

            // 2. 检查目录列表：先核心，后项目，最后 addons
            // 检查所有 checks 目录
            const checkDirs = [{ path: coreCheckDir, type: 'core' as const }]; // 添加所有 addon 的 checks 目录
            const addons = scanAddons();
            for (const addon of addons) {
                if (addonDirExists(addon, 'checks')) {
                    checkDirs.push({
                        path: getAddonDir(addon, 'checks'),
                        type: 'addon' as const,
                        addonName: addon
                    });
                }
            }

            // 按顺序扫描并执行检查函数
            for (const checkConfig of checkDirs) {
                const { path: checkDir, type } = checkConfig;
                const addonName = 'addonName' in checkConfig ? checkConfig.addonName : undefined;
                const checkTypeLabel = type === 'core' ? '核心' : type === 'project' ? '项目' : `组件${addonName}`;
                for await (const file of glob.scan({
                    cwd: checkDir,
                    onlyFiles: true,
                    absolute: true
                })) {
                    const fileName = basename(file);
                    if (fileName.startsWith('_')) continue; // 跳过以下划线开头的文件

                    // 跳过已经执行过的 conflict.ts
                    if (type === 'core' && fileName === 'conflict.ts') continue;

                    try {
                        stats.totalChecks++;
                        const singleCheckStart = Bun.nanoseconds();

                        // 导入检查模块
                        const checkModule = await import(file);

                        // 获取 default 导出的检查函数
                        const checkFn = checkModule.default;

                        // 执行检查函数
                        if (typeof checkFn === 'function') {
                            const checkResult = await checkFn();
                            const singleCheckTime = calcPerfTime(singleCheckStart);

                            // 检查返回值是否为 boolean
                            if (typeof checkResult !== 'boolean') {
                                Logger.warn(`${checkTypeLabel}检查 ${fileName} 返回值必须为 true 或 false，当前为 ${typeof checkResult}`);
                                stats.failedChecks++;
                            } else if (checkResult === true) {
                                stats.passedChecks++;
                            } else {
                                Logger.warn(`${checkTypeLabel}检查未通过: ${fileName}`);
                                stats.failedChecks++;
                            }
                        } else {
                            Logger.warn(`${checkTypeLabel}检查文件 ${fileName} 未找到 default 导出的检查函数`);
                            stats.failedChecks++;
                        }
                    } catch (error: any) {
                        const singleCheckTime = calcPerfTime(Bun.nanoseconds());
                        Logger.error(`${checkTypeLabel}检查失败 ${fileName}，耗时: ${singleCheckTime}`, error);
                        stats.failedChecks++;
                    }
                }
            }

            const totalCheckTime = calcPerfTime(checkStartTime);

            // 输出检查结果统计
            if (stats.failedChecks > 0) {
                Logger.error(`✗ 系统检查失败: ${stats.failedChecks}/${stats.totalChecks}，耗时: ${totalCheckTime}`);
                process.exit(1);
            } else if (stats.totalChecks > 0) {
                Logger.info(`✓ 系统检查通过: ${stats.passedChecks}/${stats.totalChecks}，耗时: ${totalCheckTime}`);
            }
        } catch (error: any) {
            Logger.error('执行系统检查时发生错误', error);
            process.exit(1);
        }
    }
}
