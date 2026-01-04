/**
 * Befly 钩子系统类型定义
 */

import type { BeflyContext } from "./befly.ts";
import type { RequestContext } from "./context.ts";

/**
 * 钩子处理函数类型（串联模式，无 next 参数）
 */
export type HookHandler = (befly: BeflyContext, ctx: RequestContext) => Promise<void> | void;

/**
 * 钩子配置类型
 */
export interface Hook {
    /** 钩子名称（运行时动态添加，由文件名生成） */
    name?: string;

    /** 依赖的钩子列表（在这些钩子之后执行） */
    deps: string[];

    /** 钩子处理函数 */
    handler: HookHandler;
}
