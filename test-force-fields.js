// 测试强制字段生成
const API_BASE = 'http://127.0.0.1:3001';

async function testForceFields() {
    try {
        console.log('=== 测试强制字段生成 ===\n');

        // 1. 创建文章（尝试传入自定义ID和state，应该被覆盖）
        console.log('1. 创建文章（传入自定义字段）...');
        const createRes = await fetch(`${API_BASE}/api/article/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: 99999, // 应该被覆盖
                title: '测试文章',
                content: '测试内容',
                categoryId: 1, // 必填字段
                state: 999, // 应该被覆盖为1
                created_at: 1234567890, // 应该被覆盖
                updated_at: 9876543210 // 应该被覆盖
            })
        });

        const createData = await createRes.json();
        console.log('创建结果:', JSON.stringify(createData, null, 2));

        if (createData.code === 1) {
            const articleId = createData.data;
            console.log(`\n✓ 创建成功，ID: ${articleId}`);
            console.log(`  类型: ${typeof articleId}`);
            console.log(`  位数: ${articleId.toString().length}`);

            // 2. 查询文章详情，验证字段值
            console.log('\n2. 查询文章列表...');
            const detailRes = await fetch(`${API_BASE}/api/article/list?id=${articleId}`);
            const detailData = await detailRes.json();

            if (detailData.code === 1 && detailData.data.length > 0) {
                const article = detailData.data[0];
                console.log('文章详情:', JSON.stringify(article, null, 2));

                // 验证字段
                console.log('\n3. 字段验证:');
                console.log(`  ✓ id: ${article.id} (应该是16位数字，不是99999)`);
                console.log(`  ✓ state: ${article.state} (应该是1，不是999)`);
                console.log(`  ✓ created_at: ${article.created_at} (应该是当前时间戳，不是1234567890)`);
                console.log(`  ✓ updated_at: ${article.updated_at} (应该是当前时间戳，不是9876543210)`);

                // 判断是否被强制覆盖
                const isForced = article.id !== 99999 && article.state === 1 && article.created_at !== 1234567890 && article.updated_at !== 9876543210;

                if (isForced) {
                    console.log('\n✅ 强制字段生成测试通过！');
                } else {
                    console.log('\n❌ 强制字段生成测试失败！用户输入未被覆盖');
                }
            }
        }
    } catch (error) {
        console.error('测试失败:', error.message);
    }
}

testForceFields();
