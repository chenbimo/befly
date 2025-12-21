import { isPlainObject } from "es-toolkit/compat";
import { omit } from "es-toolkit/object";

import { Logger } from "../lib/logger.js";

export async function checkApi(hooks): Promise<void> {
    for (const item of hooks) {
        try {
            const hook = item?.content || {};
            if (typeof hook?.name !== "string" || hook.name.trim() === "") {
                Logger.warn(omit(item, ["content"]), "接口的 name 属性必须是非空字符串");
                continue;
            }

            if (typeof hook?.handler !== "function") {
                Logger.warn(omit(item, ["content"]), "接口的 handler 属性必须是函数");
                continue;
            }

            if (hook.method && !["GET", "POST", "GET,POST", "POST,GET"].includes(String(hook.method).toUpperCase())) {
                Logger.warn(omit(item, ["content"]), "接口的 method 属性必须是有效的 HTTP 方法 (GET, POST, GET,POST, POST,GET)");
            }

            if (hook.auth !== undefined && typeof hook.auth !== "boolean") {
                Logger.warn(omit(item, ["content"]), "接口的 auth 属性必须是布尔值 (true=需登录, false=公开)");
            }

            if (hook.fields && !isPlainObject(hook.fields)) {
                Logger.warn(omit(item, ["content"]), "接口的 fields 属性必须是对象");
            }

            if (hook.required && !Array.isArray(hook.required)) {
                Logger.warn(omit(item, ["content"]), "接口的 required 属性必须是数组");
            }

            if (hook.required && hook.required.some((reqItem: any) => typeof reqItem !== "string")) {
                Logger.warn(omit(item, ["content"]), "接口的 required 属性必须是字符串数组");
            }
        } catch (error: any) {
            Logger.error(
                {
                    err: error,
                    item: item
                },
                "接口解析失败"
            );
        }
    }
}
