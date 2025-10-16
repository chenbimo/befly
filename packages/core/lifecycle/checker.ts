/**
 * 系统检查管理器
 * 负责在框架启动前执行系统检查
 */

import path from 'node:path';
import { Logger } from '../utils/logger.js';
import { calcPerfTime } from '../utils/index.js';
import { paths } from '../paths.js';
import { scanAddons, getAddonDir, addonDirExists } from '../utils/framework.js';
import { ErrorHandler } from '../utils/errorHandler.js';

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
                const conflictCheckPath = path.join(paths.rootCheckDir, 'conflict.ts');
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
                            Logger.error(`核心检查 conflict.ts 返回值必须为 true 或 false，当前为 ${typeof conflictResult}，耗时: ${conflictCheckTime}`);
                            stats.failedChecks++;
                        } else if (conflictResult === true) {
                            stats.passedChecks++;
                            Logger.info(`核心检查 conflict.ts 通过，耗时: ${conflictCheckTime}`);
                        } else {
                            Logger.error(`核心检查未通过: conflict.ts，耗时: ${conflictCheckTime}`);
                            stats.failedChecks++;
                            // 资源冲突检测失败，立即终止
                            ErrorHandler.critical('资源冲突检测失败，无法继续启动', undefined, {
                                totalChecks: stats.totalChecks,
                                passedChecks: stats.passedChecks,
                                failedChecks: stats.failedChecks
                            });
                        }
                    }
                }
            } catch (error: any) {
                Logger.error('执行资源冲突检测时出错:', error);
                stats.failedChecks++;
            }

            // 2. 检查目录列表：先核心，后项目，最后 addons
            // 检查所有 checks 目录
            const checkDirs = [{ path: paths.rootCheckDir, type: 'core' as const }]; // 添加所有 addon 的 checks 目录
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
                const checkTypeLabel = type === 'core' ? '核心' : type === 'project' ? '项目' : `组件[${addonName}]`;
                Logger.info(`开始执行${checkTypeLabel}检查，目录: ${checkDir}`);

                for await (const file of glob.scan({
                    cwd: checkDir,
                    onlyFiles: true,
                    absolute: true
                })) {
                    const fileName = path.basename(file);
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
                                Logger.error(`${checkTypeLabel}检查 ${fileName} 返回值必须为 true 或 false，当前为 ${typeof checkResult}，耗时: ${singleCheckTime}`);
                                stats.failedChecks++;
                            } else if (checkResult === true) {
                                stats.passedChecks++;
                                Logger.info(`${checkTypeLabel}检查 ${fileName} 通过，耗时: ${singleCheckTime}`);
                            } else {
                                Logger.error(`${checkTypeLabel}检查未通过: ${fileName}，耗时: ${singleCheckTime}`);
                                stats.failedChecks++;
                            }
                        } else {
                            const singleCheckTime = calcPerfTime(singleCheckStart);
                            Logger.error(`${checkTypeLabel}检查文件 ${fileName} 未找到 default 导出的检查函数，耗时: ${singleCheckTime}`);
                            stats.failedChecks++;
                        }
                    } catch (error: any) {
                        const singleCheckTime = calcPerfTime(Bun.nanoseconds());
                        Logger.error({
                            msg: `${checkTypeLabel}检查失败 ${fileName}，耗时: ${singleCheckTime}`,
                            error: error.message,
                            stack: error.stack
                        });
                        stats.failedChecks++;
                    }
                }
            }

            const totalCheckTime = calcPerfTime(checkStartTime);

            // 输出检查结果统计
            Logger.info(`系统检查完成! 总耗时: ${totalCheckTime}，总检查数: ${stats.totalChecks}, 通过: ${stats.passedChecks}, 失败: ${stats.failedChecks}`);

            if (stats.failedChecks > 0) {
                ErrorHandler.critical('系统检查失败，无法继续启动', undefined, {
                    totalChecks: stats.totalChecks,
                    passedChecks: stats.passedChecks,
                    failedChecks: stats.failedChecks
                });
            } else if (stats.totalChecks > 0) {
                Logger.info(`所有系统检查通过!`);
            } else {
                Logger.info(`未执行任何检查`);
            }
        } catch (error: any) {
            ErrorHandler.critical('执行系统检查时发生错误', error);
        }
    }
}
