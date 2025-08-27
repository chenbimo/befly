export default {
    after: ['_redis', '_db'],
    async onInit(befly) {
        // 增强的更新方法 - 自动添加 updated_at

        // 辅助函数：过滤掉 undefined 值和指定字段
        const filterData = (obj, excludeFields = []) => {
            return Object.fromEntries(Object.entries(obj).filter(([key, value]) => value !== undefined && !excludeFields.includes(key)));
        };

        return {
            async updData(data) {
                const updateData = {
                    ...filterData(data, ['id', 'created_at', 'deleted_at']),
                    updated_at: Date.now()
                };

                return updateData;
            },
            async insData(data) {
                const now = Date.now();

                if (Array.isArray(data)) {
                    const data2 = await Promise.all(
                        data.map(async (item) => ({
                            ...filterData(item),
                            id: await befly.redis.genTimeID(),
                            created_at: now,
                            updated_at: now
                        }))
                    );
                    return data2;
                } else {
                    const data2 = {
                        ...filterData(data),
                        id: await befly.redis.genTimeID(),
                        created_at: now,
                        updated_at: now
                    };
                    return data2;
                }
            }
        };
    }
};
