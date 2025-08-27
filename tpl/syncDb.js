// 数据库同步脚本
import { syncDb } from '../befly-core/main.js';

console.log('🚀 开始执行数据库同步脚本...');

try {
    await syncDb();
    console.log('✅ 数据库同步成功完成！');
} catch (error) {
    console.error('❌ 数据库同步失败:');
    console.error('错误详情:', error);
    console.error('错误堆栈:', error.stack);
    process.exit(1);
}
