import { validator } from './utils/validate.js';

// 测试7字段格式的验证
const testRules = {
    username: '用户名|string|3|50|user|1|^[a-zA-Z0-9_]+$',
    email: '邮箱|string|5|100|null|1|^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
    age: '年龄|number|0|150|0|0|null',
    tags: '标签|array|0|10|[]|0|null'
};

// 测试数据
const testData1 = {
    username: 'test123',
    email: 'test@example.com',
    age: 25,
    tags: ['tag1', 'tag2']
};

const testData2 = {
    username: 'a', // 太短
    email: 'invalid-email', // 格式错误
    age: 200, // 超过最大值
    tags: new Array(15).fill('tag') // 超过最大数量
};

console.log('=== 测试有效数据 ===');
const result1 = validator.validate(testData1, testRules, ['username', 'email']);
console.log('结果:', JSON.stringify(result1, null, 2));

console.log('\n=== 测试无效数据 ===');
const result2 = validator.validate(testData2, testRules, ['username', 'email']);
console.log('结果:', JSON.stringify(result2, null, 2));

console.log('\n=== 测试完成 ===');
