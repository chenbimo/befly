// 类型导入
import type { Hook } from "../types/hook.js";

// 外部依赖
import { isPlainObject, isEmpty } from "es-toolkit/compat";
import { XMLParser } from "fast-xml-parser";

// 相对导入
import { pickFields } from "../utils/pickFields.js";
import { ErrorResponse } from "../utils/response.js";

const xmlParser = new XMLParser();

/**
 * 请求参数解析钩子
 * - GET 请求：解析 URL 查询参数
 * - POST 请求：解析 JSON 或 XML 请求体
 * - 根据 API 定义的 fields 过滤字段
 * - rawBody: true 时跳过解析，由 handler 自行处理原始请求
 */
export default {
    deps: ["auth"],
    handler: async (befly, ctx) => {
        if (!ctx.api) return;

        // rawBody 模式：跳过解析，保留原始请求供 handler 自行处理
        // 适用于：微信回调、支付回调、webhook 等需要手动解密/验签的场景
        if (ctx.api.rawBody) {
            ctx.body = {};
            return;
        }

        // GET 请求：解析查询参数
        if (ctx.req.method === "GET") {
            const url = new URL(ctx.req.url);
            const params = Object.fromEntries(url.searchParams);
            if (isPlainObject(ctx.api.fields) && !isEmpty(ctx.api.fields)) {
                ctx.body = pickFields(params, Object.keys(ctx.api.fields));
            } else {
                ctx.body = params;
            }
        } else if (ctx.req.method === "POST") {
            // POST 请求：解析请求体
            const contentType = ctx.req.headers.get("content-type") || "";
            // 获取 URL 查询参数（POST 请求也可能带参数）
            const url = new URL(ctx.req.url);
            const queryParams = Object.fromEntries(url.searchParams);

            try {
                // JSON 格式
                if (contentType.includes("application/json")) {
                    const body = (await ctx.req.json()) as Record<string, any>;
                    // 合并 URL 参数和请求体（请求体优先）
                    const merged = { ...queryParams, ...body };
                    if (isPlainObject(ctx.api.fields) && !isEmpty(ctx.api.fields)) {
                        ctx.body = pickFields(merged, Object.keys(ctx.api.fields));
                    } else {
                        ctx.body = merged;
                    }
                } else if (contentType.includes("application/xml") || contentType.includes("text/xml")) {
                    // XML 格式
                    const text = await ctx.req.text();
                    const parsed = xmlParser.parse(text) as Record<string, any>;
                    // 提取根节点内容（如 xml），使 body 扁平化
                    const rootKey = Object.keys(parsed)[0];
                    const body = rootKey && typeof parsed[rootKey] === "object" ? parsed[rootKey] : parsed;
                    // 合并 URL 参数和请求体（请求体优先）
                    const merged = { ...queryParams, ...body };
                    if (isPlainObject(ctx.api.fields) && !isEmpty(ctx.api.fields)) {
                        ctx.body = pickFields(merged, Object.keys(ctx.api.fields));
                    } else {
                        ctx.body = merged;
                    }
                } else {
                    // 不支持的 Content-Type
                    ctx.response = ErrorResponse(
                        ctx,
                        "无效的请求参数格式",
                        1,
                        null,
                        {
                            location: "content-type",
                            value: contentType
                        },
                        "parser"
                    );
                    return;
                }
            } catch {
                // 解析失败：属于客户端输入错误，返回安全 detail（不回传异常栈/原始 body）
                ctx.response = ErrorResponse(
                    ctx,
                    "无效的请求参数格式",
                    1,
                    null,
                    {
                        location: "body",
                        reason: contentType.includes("application/json") ? "invalid_json" : contentType.includes("xml") ? "invalid_xml" : "invalid_body"
                    },
                    "parser"
                );
                return;
            }
        }
    }
} satisfies Hook;
