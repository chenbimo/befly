/**
 * @befly-addon/admin 统一导出入口
 * 所有对外 API 从这里导出
 */

// 布局相关（运行时）
export { Layouts, type LayoutConfig } from './layouts';

// 构建工具（仅供 vite.config.ts 等构建配置使用）
export { scanBeflyAddonViews } from './build';
