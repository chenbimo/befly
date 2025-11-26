export default {
    name: 'befly-app',
    title: '应用项目',
    version: '1.0.0',
    description: 'Befly 应用项目配置',
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
