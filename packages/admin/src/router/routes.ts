// 根据 unplugin-vue-router 扫描的文件自动生成的路由配置
// 由于 vue-router/auto-routes 虚拟模块在 Rspack 中暂不可用，手动创建此文件

import type { RouteRecordRaw } from 'vue-router';

export const routes: RouteRecordRaw[] = [
    {
        path: '/internal',
        component: () => import('@befly-addon/admin/views/index/index.vue')
    },
    {
        path: '/internal/403',
        component: () => import('@befly-addon/admin/views/403/403.vue')
    },
    {
        path: '/internal/admin',
        component: () => import('@befly-addon/admin/views/admin/index.vue')
    },
    {
        path: '/internal/dict',
        component: () => import('@befly-addon/admin/views/dict/index.vue')
    },
    {
        path: '/internal/login',
        component: () => import('@befly-addon/admin/views/login/index_1.vue')
    },
    {
        path: '/internal/menu',
        component: () => import('@befly-addon/admin/views/menu/index.vue')
    },
    {
        path: '/internal/news',
        component: () => import('@befly-addon/admin/views/news/news.vue')
    },
    {
        path: '/internal/news/detail',
        component: () => import('@befly-addon/admin/views/news/detail/detail_2.vue')
    },
    {
        path: '/internal/role',
        component: () => import('@befly-addon/admin/views/role/index.vue')
    },
    {
        path: '/internal/user',
        component: () => import('@befly-addon/admin/views/user/user.vue')
    }
];
