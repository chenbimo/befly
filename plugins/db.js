import { Env } from '../config/env.js';
import { Logger } from '../utils/logger.js';
import { createSqlClient } from '../utils/util.js';
import { DatabaseManager } from '../utils/sqlManager.js';

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
                const dbManager = new DatabaseManager(sql, befly);

                // 监听进程退出事件，确保连接池正确关闭
                const gracefulShutdown = async (signal) => {
                    Logger.info(`收到 ${signal} 信号，正在关闭数据库连接池...`);
                    try {
                        await dbManager.close();
                    } catch (error) {
                        Logger.error('优雅关闭数据库失败:', error);
                    }
                    process.exit(0);
                };

                process.on('SIGINT', gracefulShutdown);
                process.on('SIGTERM', gracefulShutdown);
                process.on('SIGUSR2', gracefulShutdown); // nodemon 重启

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

            process.exit(1);
        }
    }
};
