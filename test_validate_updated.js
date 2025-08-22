import { validator } from '../utils/validate.js';

// 测试修改后的验证器
console.log('=== 测试数字类型的正则验证 ===');

// 测试数字类型 - 正则验证
const numberRules = {
    score: '分数|number|0|100|null|1|^(100|[1-9]?[0-9])$'
};

const testCases = [
    { score: 85 }, // 应该通过
    { score: 100 }, // 应该通过
    { score: 0 }, // 应该通过
    { score: 105 }, // 应该失败（超出最大值）
    { score: -5 } // 应该失败（低于最小值）
];

testCases.forEach((testData, index) => {
    const result = validator.validate(testData, numberRules, ['score']);
    console.log(`测试 ${index + 1}: score=${testData.score}`);
    console.log('结果:', result);
    console.log('---');
});

console.log('\n=== 测试字符串类型的正则验证 ===');

// 测试字符串类型 - 正则验证
const stringRules = {
    email: '邮箱|string|5|100|null|1|^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
};

const emailTestCases = [
    { email: 'test@example.com' }, // 应该通过
    { email: 'user.name@domain.org' }, // 应该通过
    { email: 'invalid-email' }, // 应该失败（格式错误）
    { email: 'a@b.c' } // 应该通过
];

emailTestCases.forEach((testData, index) => {
    const result = validator.validate(testData, stringRules, ['email']);
    console.log(`邮箱测试 ${index + 1}: email="${testData.email}"`);
    console.log('结果:', result);
    console.log('---');
});

console.log('\n=== 测试枚举验证 ===');

// 测试枚举类型
const enumRules = {
    status: '状态|string|1|20|null|1|enum#active,inactive,pending',
    priority: '优先级|number|1|10|null|1|enum#1,2,3,4,5'
};

const enumTestCases = [
    { status: 'active', priority: 1 }, // 应该通过
    { status: 'pending', priority: 3 }, // 应该通过
    { status: 'deleted', priority: 2 }, // 状态应该失败
    { status: 'active', priority: 10 } // 优先级应该失败
];

enumTestCases.forEach((testData, index) => {
    const result = validator.validate(testData, enumRules, ['status', 'priority']);
    console.log(`枚举测试 ${index + 1}:`, testData);
    console.log('结果:', result);
    console.log('---');
});
