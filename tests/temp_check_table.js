/**
 * 测试表定义检查功能
 */

import tableCheck from '../checks/table.js';

// 重写Logger来显示错误
const Logger = {
    error: (msg) => console.error('🔴 ERROR:', msg),
    warn: (msg) => console.warn('🟡 WARN:', msg),
    info: (msg) => console.log('🔵 INFO:', msg)
};

// 暂时替换模块中的Logger
global.Logger = Logger;

console.log('🔍 开始检查表定义...');

try {
    const result = await tableCheck();
    console.log('✅ 表定义检查结果:', result);
} catch (error) {
    console.error('❌ 表定义检查失败:', error.message);
    console.error(error.stack);
}
