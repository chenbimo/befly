import { Yes } from 'befly';
import type { BeflyContext, BeflyInstance } from 'befly/types';
import type { ApiRoute } from 'befly/types';

export default {
    name: '测试接口',
    method: 'POST',
    auth: true,
    fields: {},
    required: [],
    handler: async (befly: BeflyInstance, ctx: BeflyContext) => {
        // 返回成功信息
        return Yes('测试成功');
    }
};
