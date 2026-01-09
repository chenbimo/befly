// 类型导入
import type { Hook } from "../types/hook";
import type { FieldDefinition } from "../types/validate";

// 相对导入
import { Validator } from "../lib/validator";
import { normalizeFieldDefinition } from "../utils/normalizeFieldDefinition";
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

        // 仅保留 fields 中声明的字段，并支持 snake_case 入参回退（例如 agent_id -> agentId）；同时在同一次遍历中应用默认值
        if (isPlainObject(ctx.api.fields)) {
            const rawBody = isPlainObject(ctx.body) ? (ctx.body as Record<string, any>) : {};
            const nextBody: Record<string, any> = {};

            for (const [field, fieldDef] of Object.entries(ctx.api.fields)) {
                const normalized = normalizeFieldDefinition(fieldDef as FieldDefinition);
                let value = rawBody[field];

                if (value === undefined) {
                    const snakeField = snakeCase(field);
                    if (rawBody[snakeField] !== undefined) {
                        value = rawBody[snakeField];
                    }
                }

                // 字段未传值且定义了默认值时，应用默认值
                if (value === undefined && normalized.default !== null) {
                    value = normalized.default;
                }

                if (value !== undefined) {
                    nextBody[field] = value;
                }
            }

            ctx.body = nextBody;
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
