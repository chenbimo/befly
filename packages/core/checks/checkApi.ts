import { Logger } from "../lib/logger";
import { isPlainObject, omit } from "../utils/util";

export async function checkApi(apis: unknown[]): Promise<void> {
    let hasError = false;
    const seenPaths = new Set<string>();

    for (const api of apis) {
        try {
            if (!isPlainObject(api)) {
                Logger.warn({ item: api, msg: "接口必须是对象" });
                hasError = true;
                continue;
            }

            const record = api as Record<string, unknown>;

            const name = record["name"];
            if (typeof name !== "string" || name.trim() === "") {
                Logger.warn(Object.assign({}, omit(record, ["handler"]), { msg: "接口的 name 属性必须是非空字符串" }));
                hasError = true;
                continue;
            }

            const handler = record["handler"];
            if (typeof handler !== "function") {
                Logger.warn(Object.assign({}, omit(record, ["handler"]), { msg: "接口的 handler 属性必须是函数" }));
                hasError = true;
                continue;
            }

            // path / routePrefix 由 scanFiles 系统生成：必须是严格的 pathname
            const rawPath = record["path"];
            if (typeof rawPath !== "string" || rawPath.trim() === "") {
                Logger.warn(Object.assign({}, omit(record, ["handler"]), { msg: "接口的 path 属性必须是非空字符串（由系统生成）" }));
                hasError = true;
            } else {
                const path = rawPath.trim();

                if (seenPaths.has(path)) {
                    Logger.warn(Object.assign({}, omit(record, ["handler"]), { msg: "接口的 path 重复（严格模式禁止重复 path）" }));
                    hasError = true;
                } else {
                    seenPaths.add(path);
                }

                // 不允许出现 "POST/api/..." 等 method 前缀
                if (/^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/i.test(path)) {
                    Logger.warn(Object.assign({}, omit(record, ["handler"]), { msg: "接口的 path 不允许包含 method 前缀，应为 url.pathname（例如 /api/app/xxx）" }));
                    hasError = true;
                }

                if (!path.startsWith("/api/")) {
                    Logger.warn(Object.assign({}, omit(record, ["handler"]), { msg: "接口的 path 必须以 /api/ 开头" }));
                    hasError = true;
                }

                if (path.includes(" ")) {
                    Logger.warn(Object.assign({}, omit(record, ["handler"]), { msg: "接口的 path 不允许包含空格" }));
                    hasError = true;
                }

                if (path.includes("/api//")) {
                    Logger.warn(Object.assign({}, omit(record, ["handler"]), { msg: "接口的 path 不允许出现 /api//（重复斜杠）" }));
                    hasError = true;
                }
            }

            const routePrefix = record["routePrefix"];
            if (typeof routePrefix !== "string" || routePrefix.trim() === "") {
                Logger.warn(Object.assign({}, omit(record, ["handler"]), { msg: "接口的 routePrefix 属性必须是非空字符串（由系统生成）" }));
                hasError = true;
            }

            const method = record["method"];
            if (method !== undefined && !["GET", "POST", "GET,POST"].includes(String(method).toUpperCase())) {
                Logger.warn(Object.assign({}, omit(record, ["handler"]), { msg: "接口的 method 属性必须是有效的 HTTP 方法 (GET, POST, GET,POST)" }));
                hasError = true;
            }

            const auth = record["auth"];
            if (auth !== undefined && typeof auth !== "boolean") {
                Logger.warn(Object.assign({}, omit(record, ["handler"]), { msg: "接口的 auth 属性必须是布尔值 (true=需登录, false=公开)" }));
                hasError = true;
            }

            const fields = record["fields"];
            if (fields !== undefined && fields !== null && !isPlainObject(fields)) {
                Logger.warn(Object.assign({}, omit(record, ["handler"]), { msg: "接口的 fields 属性必须是对象" }));
                hasError = true;
            }

            const required = record["required"];
            if (required !== undefined && !Array.isArray(required)) {
                Logger.warn(Object.assign({}, omit(record, ["handler"]), { msg: "接口的 required 属性必须是数组" }));
                hasError = true;
            }

            if (Array.isArray(required)) {
                if (required.some((reqItem) => typeof reqItem !== "string")) {
                    Logger.warn(Object.assign({}, omit(record, ["handler"]), { msg: "接口的 required 属性必须是字符串数组" }));
                    hasError = true;
                }
            }
        } catch (error: unknown) {
            Logger.error({ err: error, item: api, msg: "接口解析失败" });
            hasError = true;
        }
    }

    if (hasError) {
        throw new Error("接口结构检查失败");
    }
}
