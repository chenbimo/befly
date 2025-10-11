/**
 * 系统检查管理器
 * 负责在框架启动前执行系统检查
 */

import path from 'node:path';
import { Logger } from '../utils/logger.js';
import { calcPerfTime } from '../utils/index.js';
import { __dirchecks } from '../system.js';
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
            let totalChecks = 0;
            let passedChecks = 0;
            let failedChecks = 0;

            // 扫描并执行检查函数
            for await (const file of glob.scan({
                cwd: __dirchecks,
                onlyFiles: true,
                absolute: true
            })) {
                const fileName = path.basename(file);
                if (fileName.startsWith('_')) continue; // 跳过以下划线开头的文件

                try {
                    totalChecks++;
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
                            Logger.error(`检查 ${fileName} 返回值必须为 true 或 false，当前为 ${typeof checkResult}，耗时: ${singleCheckTime}`);
                            failedChecks++;
                        } else if (checkResult === true) {
                            passedChecks++;
                            Logger.info(`检查 ${fileName} 通过，耗时: ${singleCheckTime}`);
                        } else {
                            Logger.error(`检查未通过: ${fileName}，耗时: ${singleCheckTime}`);
                            failedChecks++;
                        }
                    } else {
                        const singleCheckTime = calcPerfTime(singleCheckStart);
                        Logger.error(`文件 ${fileName} 未找到 default 导出的检查函数，耗时: ${singleCheckTime}`);
                        failedChecks++;
                    }
                } catch (error: any) {
                    const singleCheckTime = calcPerfTime(singleCheckStart);
                    Logger.error({
                        msg: `检查失败 ${fileName}，耗时: ${singleCheckTime}`,
                        error: error.message,
                        stack: error.stack
                    });
                    failedChecks++;
                }
            }

            const totalCheckTime = calcPerfTime(checkStartTime);

            // 输出检查结果统计
            Logger.info(`系统检查完成! 总耗时: ${totalCheckTime}，总检查数: ${totalChecks}, 通过: ${passedChecks}, 失败: ${failedChecks}`);

            if (failedChecks > 0) {
                ErrorHandler.critical('系统检查失败，无法继续启动', undefined, {
                    totalChecks,
                    passedChecks,
                    failedChecks
                });
            } else if (totalChecks > 0) {
                Logger.info(`所有系统检查通过!`);
            } else {
                Logger.info(`未执行任何检查`);
            }
        } catch (error: any) {
            ErrorHandler.critical('执行系统检查时发生错误', error);
        }
    }
}
