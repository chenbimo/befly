export const beflyConfig = {
    // ========== 核心配置 ==========
    appName: '野蜂飞舞',
    appPort: 3000,

    // ========== Addon 配置 ==========
    addons: {
        // admin 组件配置
        admin: {
            // 邮件配置
            email: {
                host: 'smtp.qq.com',
                port: 465,
                secure: true,
                user: '',
                pass: '',
                fromName: ''
            }
        }
    },

    // ========== 自定义菜单 ==========
    menus: [
        {
            name: '用户管理',
            path: '/internal/user',
            sort: 10,
            children: [
                {
                    name: '用户列表',
                    path: '/internal/user/list',
                    sort: 1
                },
                {
                    name: '用户详情',
                    path: '/internal/user/detail',
                    sort: 2
                }
            ]
        }
    ]
};
