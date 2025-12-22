import { isPlainObject } from "es-toolkit/compat";
import { omit } from "es-toolkit/object";

import { Logger } from "../lib/logger.js";

export async function checkHook(hooks): Promise<void> {
    let hasError = false;

    for (const item of hooks) {
        try {
            const hook = item?.content;
            if (!isPlainObject(hook)) {
                Logger.warn(omit(item, ["content"]), "钩子导出必须是对象（export default { deps, handler }）");
                hasError = true;
                continue;
            }

            if (!Array.isArray((hook as any).deps)) {
                Logger.warn(omit(item, ["content"]), "钩子的 deps 属性必须是字符串数组");
                hasError = true;
                continue;
            }

            if ((hook as any).deps.some((depItem: any) => typeof depItem !== "string")) {
                Logger.warn(omit(item, ["content"]), "钩子的 deps 属性必须是字符串数组");
                hasError = true;
            }

            if (typeof (hook as any).handler !== "function") {
                Logger.warn(omit(item, ["content"]), "钩子的 handler 属性必须是函数");
                hasError = true;
                continue;
            }
        } catch (error: any) {
            Logger.error(
                {
                    err: error,
                    item: item
                },
                "钩子解析失败"
            );
            hasError = true;
        }
    }

    if (hasError) {
        throw new Error("钩子结构检查失败");
    }
}
