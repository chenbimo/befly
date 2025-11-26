/**
 * 扫描项目和所有 @befly-addon 包的 views 目录
 * 用于 unplugin-vue-router 的 routesFolder 配置
 * 注意:此函数只能在 vite.config.js 中使用(Node.js 环境),不能在浏览器中使用
 * @returns 路由文件夹配置数组
 */
export declare function scanViews(): {
    src: string;
    path: string;
    exclude: string[];
}[];
