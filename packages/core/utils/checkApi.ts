import { isPlainObject } from "es-toolkit/compat";
import { omit } from "es-toolkit/object";

import { Logger } from "../lib/logger.js";

export async function checkApi(apis): Promise<void> {
    for (const item of apis) {
        try {
            const api = item?.content || {};
            if (typeof api?.name !== "string" || api.name.trim() === "") {
                Logger.warn(omit(item, ["content"]), "接口的 name 属性必须是非空字符串");
                continue;
            }

            if (typeof api?.handler !== "function") {
                Logger.warn(omit(item, ["content"]), "接口的 handler 属性必须是函数");
                continue;
            }

            if (api.method && !["GET", "POST", "GET,POST", "POST,GET"].includes(String(api.method).toUpperCase())) {
                Logger.warn(omit(item, ["content"]), "接口的 method 属性必须是有效的 HTTP 方法 (GET, POST, GET,POST, POST,GET)");
            }

            if (api.auth !== undefined && typeof api.auth !== "boolean") {
                Logger.warn(omit(item, ["content"]), "接口的 auth 属性必须是布尔值 (true=需登录, false=公开)");
            }

            if (api.fields && !isPlainObject(api.fields)) {
                Logger.warn(omit(item, ["content"]), "接口的 fields 属性必须是对象");
            }

            if (api.required && !Array.isArray(api.required)) {
                Logger.warn(omit(item, ["content"]), "接口的 required 属性必须是数组");
            }

            if (api.required && api.required.some((reqItem: any) => typeof reqItem !== "string")) {
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
