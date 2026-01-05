/**
 * 插件类型定义
 *
 * 说明：当前 core 插件的默认导出形态是：{ deps?: string[], handler(ctx): any }
 */

import type { BeflyContext } from "./befly";

export interface Plugin {
    /** 运行时由 loader 注入（默认导出对象中通常不需要写） */
    name?: string;

    /** 是否启用该插件；必填（true/false） */
    enable: boolean;

    /** 依赖的插件名（由文件名推导出的插件名），用于排序 */
    deps?: string[];

    /** 插件初始化函数（返回会被挂到 befly 上） */
    handler: (context: BeflyContext) => Promise<any> | any;
}
