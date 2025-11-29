/**
 * 路由配置接口
 */
export interface RouteConfig {
    path?: string;
    component?: any;
    children?: RouteConfig[];
    meta?: Record<string, any>;
    [key: string]: any;
}
/**
 * 布局配置接口
 */
export interface LayoutConfig {
    path: string;
    layoutName: string;
    component: any;
    children?: LayoutConfig[];
    meta?: Record<string, any>;
    [key: string]: any;
}
/**
 * 自定义布局处理函数
 * 根据文件名后缀判断使用哪个布局
 * @param routes - 原始路由配置
 * @param inheritLayout - 继承的布局名称（来自父级目录）
 * @returns 处理后的布局配置（不包含实际的布局组件导入）
 */
export declare function Layouts(routes: RouteConfig[], inheritLayout?: string): LayoutConfig[];
