import type { Plugin } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import autoRoutes from 'virtual:auto-routes';

/**
 * 路由插件
 * 导出为 Vue Plugin，可直接用 app.use() 安装
 */
export const RouterPlugin: Plugin = {
    install(app) {
        // 创建路由实例
        const router = createRouter({
            history: createWebHistory(import.meta.env.BASE_URL),
            routes: autoRoutes
        });

        // 路由守卫
        router.beforeEach((to, from, next) => {
            // 设置页面标题
            if (to.meta.title) {
                document.title = `${to.meta.title} - Befly Admin`;
            }

            // 登录验证
            const token = localStorage.getItem('token');
            if (!to.meta.public && !token) {
                next('/login');
            } else {
                next();
            }
        });

        // 安装路由
        app.use(router);
    }
};
