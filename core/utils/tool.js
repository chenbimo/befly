import { omitFields } from './index.js';

// 工具类：通过构造函数注入 befly
export class Tool {
    constructor(befly) {
        this.befly = befly;
    }

    async updData(data, now = Date.now()) {
        const cleaned = omitFields(data ?? {}, ['id', 'created_at', 'deleted_at'], [undefined]);
        return { ...cleaned, updated_at: now };
    }

    async insData(data, now = Date.now()) {
        const genId = async () => await this.befly.redis.genTimeID();

        if (Array.isArray(data)) {
            return await Promise.all(
                data.map(async (item) => ({
                    ...omitFields(item ?? {}, [], [undefined]),
                    id: await genId(),
                    created_at: now,
                    updated_at: now
                }))
            );
        } else {
            const cleaned = omitFields(data ?? {}, [], [undefined]);
            return { ...cleaned, id: await genId(), created_at: now, updated_at: now };
        }
    }
}
