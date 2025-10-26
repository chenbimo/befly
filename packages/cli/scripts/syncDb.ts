import { SyncDb } from './syncDb/index.js';
import { Logger } from '../utils/logger.js';

// 如果直接运行此脚本
if (import.meta.main) {
    SyncDb().catch((error) => {
        Logger.error('数据库同步失败', error);
        process.exit(1);
    });
}
