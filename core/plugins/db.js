import { Env } from '../config/env.js';
import { Logger } from '../utils/logger.js';
import { createSqlClient } from '../utils/util.js';
import { SqlManager } from '../utils/sqlManager.js';

// 统一使用 utils/util.js 提供的 createSqlClient

export default {
    after: ['_redis'],
    async onInit(befly) {
        let sql = null;

        try {
            if (Env.MYSQL_ENABLE === 1) {
                // 创建 Bun SQL 客户端（内置连接池），并确保连接验证成功后再继续
                sql = await createSqlClient();

                // 创建数据库管理器实例（迁移到 utils/sqlManager.js）
                const dbManager = new SqlManager(sql, befly);

                return dbManager;
            } else {
                Logger.warn(`MySQL 未启用，跳过初始化`);
                return {};
            }
        } catch (error) {
            Logger.error({
                msg: '数据库初始化失败',
                message: error.message,
                stack: error.stack
            });

            // 清理资源
            if (sql) {
                try {
                    await sql.close();
                } catch (cleanupError) {
                    Logger.error('清理连接池失败:', cleanupError);
                }
            }

            // 插件内禁止直接退出进程，抛出异常交由主流程统一处理
            throw error;
        }
    }
};
