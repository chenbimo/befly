import { presetFields } from "../configs/presetFields.js";

/**
 * 处理字段定义：将 @ 符号引用替换为实际字段定义
 */
export function processFields(fields: Record<string, any>, apiName: string, routePath: string): Record<string, any> {
    if (!fields || typeof fields !== "object") return fields;

    const processed: Record<string, any> = {};
    for (const [key, value] of Object.entries(fields)) {
        if (typeof value === "string" && value.startsWith("@")) {
            if (presetFields[value]) {
                processed[key] = presetFields[value];
                continue;
            }

            const validKeys = Object.keys(presetFields).join(", ");
            throw new Error(`API [${apiName}] (${routePath}) 字段 [${key}] 引用了未定义的预设字段 "${value}"。可用的预设字段有: ${validKeys}`);
        }

        processed[key] = value;
    }

    return processed;
}
