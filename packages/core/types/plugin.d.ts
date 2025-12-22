/**
 * Befly 插件系统类型定义
 */

import type { BeflyContext } from "./befly.js";

/**
 * 插件配置类型
 */
export interface Plugin {
    /** 插件名称（运行时动态添加，由文件名生成） */
    name?: string;

    /** 依赖的插件列表（在这些插件之后执行） */
    deps: string[];

    /** 插件初始化函数 */
    handler: (context: BeflyContext) => any | Promise<any>;
}
