/**
 * 数据库插件 - TypeScript 版本
 * 初始化数据库连接和 SQL 管理器
 */

import { Env } from '../config/env.js';
import { Logger } from '../utils/logger.js';
import { createSqlClient } from '../utils/index.js';
import { SqlHelper } from '../utils/sqlHelper.js';
import type { Plugin } from '../types/plugin.js';
import type { BeflyContext } from '../types/befly.js';

/**
 * 数据库插件
 */
const dbPlugin: Plugin = {
    name: '_db',
    after: ['_redis'],

    async onInit(befly: BeflyContext): Promise<SqlHelper | Record<string, never>> {
        let sql: any = null;

        try {
            if (Env.DB_ENABLE === 1) {
                // 创建 Bun SQL 客户端（内置连接池），并确保连接验证成功后再继续
                sql = await createSqlClient();

                // 包装 SQL 对象以符合 DatabaseConnection 接口
                const connection = {
                    query: async (sqlStr: string, params?: any[]) => {
                        if (params && params.length > 0) {
                            // 将带 ? 占位符的 SQL 转换为 Bun SQL 模板格式
                            // 将 SQL 按 ? 分割成字符串数组
                            const sqlParts = sqlStr.split('?');

                            // 使用 Bun SQL 的模板标签语法
                            return await sql(sqlParts, ...params);
                        } else {
                            return await sql.unsafe(sqlStr);
                        }
                    },
                    close: async () => {
                        await sql.close();
                    }
                };

                // 创建数据库管理器实例
                const dbManager = new SqlHelper(befly, connection);

                Logger.info('数据库插件初始化成功');
                return dbManager;
            } else {
                Logger.warn('数据库未启用（DB_ENABLE≠1），跳过初始化');
                return {};
            }
        } catch (error: any) {
            Logger.error({
                msg: '数据库初始化失败',
                message: error.message,
                stack: error.stack
            });

            // 清理资源
            if (sql) {
                try {
                    await sql.close();
                } catch (cleanupError: any) {
                    Logger.error('清理连接池失败:', cleanupError);
                }
            }

            // 插件内禁止直接退出进程，抛出异常交由主流程统一处理
            throw error;
        }
    }
};

export default dbPlugin;
