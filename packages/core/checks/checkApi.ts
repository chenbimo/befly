import { Logger } from "../lib/logger";
import { isPlainObject, omit } from "../utils/util";

export async function checkApi(apis: any[]): Promise<void> {
    let hasError = false;

    for (const api of apis) {
        try {
            if (typeof api?.name !== "string" || api.name.trim() === "") {
                Logger.warn(Object.assign({}, omit(api, ["handler"]), { msg: "接口的 name 属性必须是非空字符串" }));
                hasError = true;
                continue;
            }

            if (typeof api?.handler !== "function") {
                Logger.warn(Object.assign({}, omit(api, ["handler"]), { msg: "接口的 handler 属性必须是函数" }));
                hasError = true;
                continue;
            }

            // path / routePrefix 由 scanFiles 系统生成：必须是严格的 pathname
            if (typeof api?.path !== "string" || api.path.trim() === "") {
                Logger.warn(Object.assign({}, omit(api, ["handler"]), { msg: "接口的 path 属性必须是非空字符串（由系统生成）" }));
                hasError = true;
            } else {
                const path = api.path.trim();

                // 不允许出现 "POST/api/..." 等 method 前缀
                if (/^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/i.test(path)) {
                    Logger.warn(Object.assign({}, omit(api, ["handler"]), { msg: "接口的 path 不允许包含 method 前缀，应为 url.pathname（例如 /api/app/xxx）" }));
                    hasError = true;
                }

                if (!path.startsWith("/api/")) {
                    Logger.warn(Object.assign({}, omit(api, ["handler"]), { msg: "接口的 path 必须以 /api/ 开头" }));
                    hasError = true;
                }

                if (path.includes(" ")) {
                    Logger.warn(Object.assign({}, omit(api, ["handler"]), { msg: "接口的 path 不允许包含空格" }));
                    hasError = true;
                }

                if (path.includes("/api//")) {
                    Logger.warn(Object.assign({}, omit(api, ["handler"]), { msg: "接口的 path 不允许出现 /api//（重复斜杠）" }));
                    hasError = true;
                }
            }

            if (typeof api?.routePrefix !== "string" || api.routePrefix.trim() === "") {
                Logger.warn(Object.assign({}, omit(api, ["handler"]), { msg: "接口的 routePrefix 属性必须是非空字符串（由系统生成）" }));
                hasError = true;
            }

            if (api.method && !["GET", "POST", "GET,POST", "POST,GET"].includes(String(api.method).toUpperCase())) {
                Logger.warn(Object.assign({}, omit(api, ["handler"]), { msg: "接口的 method 属性必须是有效的 HTTP 方法 (GET, POST, GET,POST, POST,GET)" }));
                hasError = true;
            }

            if (api.auth !== undefined && typeof api.auth !== "boolean") {
                Logger.warn(Object.assign({}, omit(api, ["handler"]), { msg: "接口的 auth 属性必须是布尔值 (true=需登录, false=公开)" }));
                hasError = true;
            }

            if (api.fields && !isPlainObject(api.fields)) {
                Logger.warn(Object.assign({}, omit(api, ["handler"]), { msg: "接口的 fields 属性必须是对象" }));
                hasError = true;
            }

            if (api.required && !Array.isArray(api.required)) {
                Logger.warn(Object.assign({}, omit(api, ["handler"]), { msg: "接口的 required 属性必须是数组" }));
                hasError = true;
            }

            if (api.required && api.required.some((reqItem: any) => typeof reqItem !== "string")) {
                Logger.warn(Object.assign({}, omit(api, ["handler"]), { msg: "接口的 required 属性必须是字符串数组" }));
                hasError = true;
            }
        } catch (error: any) {
            Logger.error({ err: error, item: api, msg: "接口解析失败" });
            hasError = true;
        }
    }

    if (hasError) {
        throw new Error("接口结构检查失败");
    }
}
