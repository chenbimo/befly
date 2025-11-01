import { Yes } from 'befly';

export default {
    name: '获取角色列表',
    handler: async (befly, ctx) => {
        const roles = await befly.db.getList({
            limit: 30,
            table: 'core_role',
            orderBy: ['sort#ASC', 'id#ASC']
        });

        return Yes('操作成功', roles);
    }
};
