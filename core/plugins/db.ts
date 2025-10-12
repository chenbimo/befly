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
                            // 手动将参数转义并替换到 SQL 中
                            // 这不是最优方案，但对于 Bun SQL 当前的 API 来说是必要的
                            let finalSql = sqlStr;
                            for (const param of params) {
                                // 简单的参数转义（实际应该更严格）
                                let escaped: string;
                                if (param === null) {
                                    escaped = 'NULL';
                                } else if (typeof param === 'string') {
                                    // 转义单引号
                                    escaped = `'${param.replace(/'/g, "''")}'`;
                                } else if (typeof param === 'number') {
                                    escaped = String(param);
                                } else if (typeof param === 'boolean') {
                                    escaped = param ? '1' : '0';
                                } else {
                                    escaped = `'${String(param)}'`;
                                }
                                // 替换第一个 ?
                                finalSql = finalSql.replace('?', escaped);
                            }
                            // 使用 unsafe 执行替换后的 SQL
                            return await sql.unsafe(finalSql);
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
