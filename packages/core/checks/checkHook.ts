import { isPlainObject } from "es-toolkit/compat";
import { omit } from "es-toolkit/object";

import { Logger } from "../lib/logger";

export async function checkHook(hooks: any[]): Promise<void> {
    let hasError = false;

    for (const hook of hooks) {
        try {
            if (!isPlainObject(hook)) {
                Logger.warn(omit(hook, ["handler"]), "钩子导出必须是对象（export default { deps, handler }）");
                hasError = true;
                continue;
            }

            // enable 必须显式声明且只能为 boolean（true/false），不允许 0/1 等其他类型。
            if (!Object.prototype.hasOwnProperty.call(hook as any, "enable")) {
                Logger.warn(omit(hook, ["handler"]), "钩子的 enable 属性是必填项，且必须显式声明为 true 或 false");
                hasError = true;
                continue;
            }

            if (typeof (hook as any).enable !== "boolean") {
                Logger.warn(omit(hook, ["handler"]), "钩子的 enable 属性必须是 boolean（true/false），不允许 0/1 等其他类型");
                hasError = true;
                continue;
            }

            if (!Array.isArray((hook as any).deps)) {
                Logger.warn(omit(hook, ["handler"]), "钩子的 deps 属性必须是字符串数组");
                hasError = true;
                continue;
            }

            if ((hook as any).deps.some((depItem: any) => typeof depItem !== "string")) {
                Logger.warn(omit(hook, ["handler"]), "钩子的 deps 属性必须是字符串数组");
                hasError = true;
            }

            if (typeof (hook as any).handler !== "function") {
                Logger.warn(omit(hook, ["handler"]), "钩子的 handler 属性必须是函数");
                hasError = true;
                continue;
            }
        } catch (error: any) {
            Logger.error(
                {
                    err: error,
                    item: hook
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
