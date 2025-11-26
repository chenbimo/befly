export default {
    name: 'admin',
    title: '管理后台',
    version: '1.0.0',
    description: '提供管理后台的基础功能，包括管理员注册、登录、用户信息管理等',
    author: {
        name: 'Befly Team'
    },
    keywords: ['admin', 'backend', 'management'],
    license: 'MIT',
    menus: [
        {
            name: '首页',
            path: '/',
            sort: 1
        },
        {
            name: '人员管理',
            path: '/_people',
            sort: 2,
            children: [
                {
                    name: '管理员管理',
                    path: '/admin',
                    sort: 2
                }
            ]
        },
        {
            name: '权限设置',
            path: '/_permission',
            sort: 3,
            children: [
                {
                    name: '角色管理',
                    path: '/role',
                    sort: 5
                }
            ]
        },
        {
            name: '字典管理',
            path: '/dict',
            sort: 6
        }
    ]
};
