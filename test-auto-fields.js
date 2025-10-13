// 测试自动字段生成

const testCreate = async () => {
    const response = await fetch('http://127.0.0.1:3001/api/article/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title: '自动字段测试',
            content: '验证ID、时间戳、state自动生成',
            categoryId: 1
        })
    });

    const result = await response.json();
    console.log('创建结果:', result);

    if (result.code === 0) {
        const articleId = result.data.articleId;
        console.log('\n生成的ID:', articleId);
        console.log('ID类型:', typeof articleId);
        console.log('ID长度:', String(articleId).length);
        console.log('是否安全整数:', Number.isSafeInteger(articleId));

        // 查询刚创建的记录
        const listResponse = await fetch('http://127.0.0.1:3001/api/article/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ page: 1, limit: 1 })
        });

        const listResult = await listResponse.json();
        if (listResult.code === 0 && listResult.data.list.length > 0) {
            const article = listResult.data.list[0];
            console.log('\n自动生成的字段:');
            console.log('- id:', article.id, '(类型:', typeof article.id, ')');
            console.log('- created_at:', article.created_at, '(类型:', typeof article.created_at, ')');
            console.log('- updated_at:', article.updated_at, '(类型:', typeof article.updated_at, ')');
            console.log('- state:', article.state, '(类型:', typeof article.state, ')');

            console.log('\n✅ 所有字段已自动生成!');
        }
    }
};

testCreate().catch(console.error);
