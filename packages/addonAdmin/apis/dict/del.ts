import { Field, Yes, No } from 'befly';
export default {
    name: '删除字典',
    handler: async (befly, ctx) => {
        try {
            await befly.db.delData({
                table: 'addon_admin_dict',
                where: {
                    id: ctx.body.id
                }
            });

            return befly.tool.Yes('操作成功');
        } catch (error) {
            befly.logger.error('删除字典失败:', error);
            return befly.tool.No('操作失败');
        }
    }
};
