/**
 * API 测试脚本
 * 用于测试各个接口的功能
 */

const BASE_URL = 'http://127.0.0.1:3001';

interface ApiResponse {
    code: number;
    msg: string;
    data?: any;
}

async function testApi(name: string, path: string, body: any = {}) {
    try {
        const response = await fetch(`${BASE_URL}${path}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const result: ApiResponse = await response.json();

        if (result.code === 0) {
            console.log(`✅ ${name} - 成功`);
            console.log(`   返回: ${result.msg}`);
            if (result.data) {
                console.log(`   数据:`, JSON.stringify(result.data).substring(0, 100));
            }
        } else {
            console.log(`❌ ${name} - 失败`);
            console.log(`   错误: ${result.msg}`);
            if (result.data) {
                console.log(`   详情:`, result.data);
            }
        }
    } catch (error) {
        console.log(`💥 ${name} - 异常`);
        console.log(`   错误:`, error.message);
    }
    console.log('');
}

async function runTests() {
    console.log('========================================');
    console.log('🚀 开始 API 测试');
    console.log('========================================\n');

    // 1. 健康检查
    await testApi('健康检查', '/api/health/info', {});

    // 2. 文章列表
    await testApi('文章列表', '/api/article/list', { page: 1, limit: 10 });

    // 3. 用户登录
    await testApi('用户登录', '/api/user/login', { username: 'admin', password: '123456' });

    // 4. Demo 列表
    await testApi('Demo 列表', '/api/demo/list', { page: 1, limit: 10 });

    console.log('========================================');
    console.log('✅ 测试完成');
    console.log('========================================');
}

// 执行测试
runTests().catch(console.error);
