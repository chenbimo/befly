import type { RouteRecordRaw, Component } from 'vue-router';

/**
 * 布局配置接口
 */
export interface LayoutConfig {
    path: string;
    layoutName: string;
    component: Component;
    children?: LayoutConfig[];
    meta?: Record<string, any>;
}
