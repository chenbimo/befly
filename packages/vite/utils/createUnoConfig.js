/**
 * UnoCSS 配置创建函数（对外稳定导出）
 *
 * 注意：befly-vite 不再从主入口导出 configs/plugins，统一通过 utils 子路径导入。
 */

export { createUnoConfig } from "../configs/uno.config.js";
