import { Api, Yes, No } from 'befly';
import type { BeflyContext, BeflyInstance } from 'befly';

export default Api('测试接口', {
    method: 'POST',
    auth: true,
    fields: {},
    required: [],
    handler: async (befly: BeflyInstance, ctx: BeflyContext) => {
        // 返回成功信息
        return Yes('测试成功');
    }
});
