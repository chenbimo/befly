/**
 * Hook 类型定义
 *
 * 说明：当前 core 的 hook 执行模型是“顺序执行 handler(befly, ctx)”，无 next / 洋葱链。
 */

import type { BeflyContext } from "./befly.ts";
import type { RequestContext } from "./context.ts";

export interface Hook {
    /** 运行时由 loader 注入（默认导出对象中通常不需要写） */
    name?: string;

    /** 依赖的 hook（按文件名推导的 hookName），用于排序 */
    deps?: string[];

    /** hook 处理函数 */
    handler: (befly: BeflyContext, ctx: RequestContext) => Promise<void> | void;
}
