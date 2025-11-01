import { Field, Yes, No } from 'befly';
export default {
    name: '删除字典',
    handler: async (befly, ctx) => {
        try {
            await befly.db.delData({
                table: 'core_dict',
                where: {
                    id: ctx.body.id
                }
            });

            return Yes('操作成功');
        } catch (error) {
            befly.logger.error('删除字典失败:', error);
            return No('操作失败');
        }
    }
};
