import { Yes } from 'befly';

export default {
    name: '测试接口',
    handler: async (befly, ctx) => {
        // 返回成功信息
        return Yes('测试成功');
    }
};
