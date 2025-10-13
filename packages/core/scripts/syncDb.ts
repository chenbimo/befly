import { SyncDb } from './syncDb/index.js';

// 如果直接运行此脚本
if (import.meta.main) {
    SyncDb().catch((error) => {
        console.error('❌ 数据库同步失败:', error);
        process.exit(1);
    });
}
