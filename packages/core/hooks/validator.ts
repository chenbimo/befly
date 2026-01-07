// 类型导入
import type { Hook } from "../types/hook";

// 相对导入
import { Validator } from "../lib/validator";
import { ErrorResponse } from "../utils/response";
import { isPlainObject, snakeCase } from "../utils/util";

/**
 * 参数验证钩子
 * 根据 API 定义的 fields 和 required 验证请求参数
 */
const validatorHook: Hook = {
    name: "validator",
    enable: true,
    deps: ["parser"],
    handler: async (befly, ctx) => {
        if (!ctx.api) return;

        // 无需验证
        if (!ctx.api.fields) {
            return;
        }

        // 仅保留 fields 中声明的字段，并支持 snake_case 入参回退（例如 agent_id -> agentId）
        if (isPlainObject(ctx.api.fields)) {
            const rawBody = isPlainObject(ctx.body) ? (ctx.body as Record<string, any>) : {};
            const filteredBody: Record<string, any> = {};

            for (const field of Object.keys(ctx.api.fields)) {
                if (rawBody[field] !== undefined) {
                    filteredBody[field] = rawBody[field];
                    continue;
                }

                const snakeField = snakeCase(field);
                if (rawBody[snakeField] !== undefined) {
                    filteredBody[field] = rawBody[snakeField];
                }
            }

            ctx.body = filteredBody;
        }

        // 应用字段默认值
        for (const [field, fieldDef] of Object.entries(ctx.api.fields)) {
            // 字段未传值且定义了默认值时，应用默认值
            if (ctx.body[field] === undefined && (fieldDef as any)?.default !== undefined && (fieldDef as any)?.default !== null) {
                ctx.body[field] = (fieldDef as any).default;
            }
        }

        // 验证参数
        const result = Validator.validate(ctx.body, ctx.api.fields, ctx.api.required || []);

        if (result.code !== 0) {
            ctx.response = ErrorResponse(ctx, result.firstError || "参数验证失败", 1, null, result.fieldErrors, "validator");
            return;
        }
    }
};

export default validatorHook;
