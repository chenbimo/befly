import { Api, Yes, No } from 'befly';

export default Api.POST(
    //
    '测试接口',
    true,
    {},
    [],
    async (befly, ctx) => {
        try {
            // 返回成功信息
            return Yes('测试成功');
        } catch (error) {
            befly.logger.error(`文件处理错误: ${error.message}`);
            return No('测试失败');
        }
    }
);
