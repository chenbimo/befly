/**
 * 直接测试正则表达式验证逻辑
 */

// 测试无效正则表达式
const invalidRegex = '[unclosed regex';

console.log('测试无效正则表达式:', invalidRegex);

try {
    new RegExp(invalidRegex);
    console.log('❌ 意外：无效正则通过了验证');
} catch (e) {
    console.log('✅ 正确：检测到无效正则表达式:', e.message);
}

// 测试有效正则表达式
const validRegex = '^[a-zA-Z]+$';

console.log('测试有效正则表达式:', validRegex);

try {
    new RegExp(validRegex);
    console.log('✅ 正确：有效正则通过验证');
} catch (e) {
    console.log('❌ 意外：有效正则验证失败:', e.message);
}
