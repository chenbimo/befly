import { Api, Yes, No } from 'befly';
import type { BeflyContext, BeflyInstance } from 'befly';

export default Api.POST(
    //
    '测试接口',
    true,
    {},
    [],
    async (befly: BeflyInstance, ctx: BeflyContext) => {
        // 返回成功信息
        return Yes('测试成功');
    }
);
