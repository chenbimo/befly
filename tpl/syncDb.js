// 数据库同步脚本
// 直接从工作区 core 源码导入 SyncDb，避免本地依赖解析问题
import { SyncDb } from 'befly';

console.log('🚀 开始执行数据库同步脚本...');

try {
    await SyncDb();
    console.log('✅ 数据库同步成功完成！');
} catch (error) {
    console.error('❌ 数据库同步失败:');
    console.error('错误详情:', error);
    console.error('错误堆栈:', error.stack);
    process.exit(1);
}
