/// <reference types="vite/client" />

declare module '*.vue' {
    import type { DefineComponent } from 'vue';
    const component: DefineComponent<{}, {}, any>;
    export default component;
}

// 自动路由模块声明
declare module 'virtual:auto-routes' {
    import type { RouteRecordRaw } from 'vue-router';
    const routes: RouteRecordRaw[];
    export default routes;
}

interface ImportMetaEnv {
    readonly VITE_API_URL: string;
    readonly VITE_APP_TITLE: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
