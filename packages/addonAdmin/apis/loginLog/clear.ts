export default {
    name: '清空登录日志',
    handler: async (befly, ctx) => {
        await befly.db.execute({
            sql: 'DELETE FROM addon_admin_login_log WHERE 1=1'
        });

        return befly.tool.Yes('清空成功');
    }
};
