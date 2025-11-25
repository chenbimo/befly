export default {
    name: '获取更新日志',
    handler: async (befly, ctx) => {
        // 更新日志数据（实际项目中可以从配置文件或数据库读取）
        const changelog = [
            {
                version: 'v1.0.0',
                date: '2025-10-25',
                changes: ['新增角色权限管理功能', '新增菜单权限分配功能', '新增接口权限管理功能', '优化菜单同步性能', '优化字段类型验证', '修复数组类型字段验证bug']
            },
            {
                version: 'v0.9.0',
                date: '2025-10-20',
                changes: ['初始版本发布', '完成基础框架搭建', '实现用户认证功能', '实现RBAC权限系统']
            },
            {
                version: 'v0.8.0',
                date: '2025-10-15',
                changes: ['完成数据库设计', '实现核心API', '添加字段验证器', '集成Redis缓存']
            }
        ];

        // 根据 limit 参数返回指定数量的日志
        const limit = ctx.body.limit || 5;
        const lists = changelog.slice(0, limit);

        return befly.tool.Yes('获取成功', {
            lists: lists
        });
    }
};
