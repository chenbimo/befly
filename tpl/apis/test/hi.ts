import { Api, Yes, No } from 'befly';
import type { BeflyContext, BeflyInstance } from 'befly';

export default Api.POST(
    //
    '测试接口',
    true,
    {},
    [],
    async (befly: BeflyInstance, ctx: BeflyContext) => {
        try {
            // 返回成功信息
            return Yes('测试成功');
        } catch (error) {
            const err = error as Error;
            befly.logger.error(`文件处理错误: ${err.message}`);
            return No('测试失败');
        }
    }
);
