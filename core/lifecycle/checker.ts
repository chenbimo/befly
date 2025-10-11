/**
 * 系统检查管理器
 * 负责在框架启动前执行系统检查
 */

import path from 'node:path';
import { Logger } from '../utils/logger.js';
import { calcPerfTime } from '../utils/index.js';
import { __dirchecks, getProjectDir } from '../system.js';
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

            const glob = new Bun.Glob('*.{js,ts}');

            // 统计信息
            const stats = {
                totalChecks: 0,
                passedChecks: 0,
                failedChecks: 0
            };

            // 检查目录列表：先核心，后项目
            const checkDirs = [
                { path: __dirchecks, type: 'core' as const },
                { path: getProjectDir('checks'), type: 'project' as const }
            ];

            // 按顺序扫描并执行检查函数
            for (const { path: checkDir, type } of checkDirs) {
                const checkTypeLabel = type === 'core' ? '核心' : '项目';
                Logger.info(`开始执行${checkTypeLabel}检查，目录: ${checkDir}`);

                for await (const file of glob.scan({
                    cwd: checkDir,
                    onlyFiles: true,
                    absolute: true
                })) {
                    const fileName = path.basename(file);
                    if (fileName.startsWith('_')) continue; // 跳过以下划线开头的文件

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
