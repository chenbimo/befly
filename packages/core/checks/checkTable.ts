import type { FieldDefinition } from "../types/validate";
import type { ScanFileResult } from "../utils/scanFiles";

import { Logger } from "../lib/logger";

/**
 * 保留字段列表
 */
const RESERVED_FIELDS = ["id", "created_at", "updated_at", "deleted_at", "state"] as const;
const RESERVED_FIELD_SET = new Set<string>(RESERVED_FIELDS);

/**
 * 允许的字段类型
 */
const FIELD_TYPES = ["string", "number", "text", "array_string", "array_text", "array_number_string", "array_number_text"] as const;
const FIELD_TYPE_SET = new Set<string>(FIELD_TYPES);

/**
 * 允许的字段属性列表
 */
const ALLOWED_FIELD_PROPERTIES = ["name", "type", "min", "max", "default", "detail", "index", "unique", "nullable", "unsigned", "regexp"] as const;
const ALLOWED_FIELD_PROPERTY_SET = new Set<string>(ALLOWED_FIELD_PROPERTIES);

/**
 * 小驼峰命名正则
 * 可选：以下划线开头（用于特殊文件，如通用字段定义）
 * 必须以小写字母开头，后续可包含小写/数字，或多个 [大写+小写/数字] 片段
 * 示例：userTable、testCustomers、common
 */
const LOWER_CAMEL_CASE_REGEX = /^_?[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)*$/;

/**
 * 字段名称正则
 * 必须为中文、数字、字母、下划线、短横线、空格
 */
const FIELD_NAME_REGEX = /^[\u4e00-\u9fa5a-zA-Z0-9 _-]+$/;

/**
 * VARCHAR 最大长度限制
 */
const MAX_VARCHAR_LENGTH = 65535;

/**
 * 检查表定义文件
 * @throws 当检查失败时抛出异常
 */
export async function checkTable(tables: ScanFileResult[]): Promise<void> {
    // 收集所有表文件
    let hasError = false;

    // 合并进行验证逻辑
    for (const item of tables) {
        if (item.type !== "table") {
            continue;
        }

        const sourceName = typeof item.sourceName === "string" ? item.sourceName : "";
        const tablePrefix = sourceName ? `${sourceName}表 ` : "表 ";

        try {
            const fileName = item.fileName;
            const table = item.content || {};
            // 1) 文件名小驼峰校验
            if (!LOWER_CAMEL_CASE_REGEX.test(fileName)) {
                Logger.warn(`${tablePrefix}${fileName} 文件名必须使用小驼峰命名（例如 testCustomers.json）`);
                hasError = true;
                continue;
            }

            // 检查 table 中的每个验证规则
            for (const [colKey, fieldDef] of Object.entries(table)) {
                if (typeof fieldDef !== "object" || fieldDef === null || Array.isArray(fieldDef)) {
                    Logger.warn(`${tablePrefix}${fileName} 文件 ${colKey} 规则必须为对象`);
                    hasError = true;
                    continue;
                }

                // 检查是否使用了保留字段
                if (RESERVED_FIELD_SET.has(colKey)) {
                    Logger.warn(`${tablePrefix}${fileName} 文件包含保留字段 ${colKey}，` + `不能在表定义中使用以下字段: ${RESERVED_FIELDS.join(", ")}`);
                    hasError = true;
                }

                // 直接使用字段对象
                const field = fieldDef as FieldDefinition;

                // 检查是否存在非法属性
                const fieldKeys = Object.keys(field);
                const illegalProps = fieldKeys.filter((key) => !ALLOWED_FIELD_PROPERTY_SET.has(key));
                if (illegalProps.length > 0) {
                    Logger.warn(`${tablePrefix}${fileName} 文件 ${colKey} 包含非法属性: ${illegalProps.join(", ")}，` + `允许的属性为: ${ALLOWED_FIELD_PROPERTIES.join(", ")}`);
                    hasError = true;
                }

                // 检查必填字段：name, type
                if (!field.name || typeof field.name !== "string") {
                    Logger.warn(`${tablePrefix}${fileName} 文件 ${colKey} 缺少必填字段 name 或类型错误`);
                    hasError = true;
                    continue;
                }
                if (!field.type || typeof field.type !== "string") {
                    Logger.warn(`${tablePrefix}${fileName} 文件 ${colKey} 缺少必填字段 type 或类型错误`);
                    hasError = true;
                    continue;
                }

                // 检查可选字段的类型
                if (field.min !== undefined && !(field.min === null || typeof field.min === "number")) {
                    Logger.warn(`${tablePrefix}${fileName} 文件 ${colKey} 字段 min 类型错误，必须为 null 或数字`);
                    hasError = true;
                }
                if (field.max !== undefined && !(field.max === null || typeof field.max === "number")) {
                    Logger.warn(`${tablePrefix}${fileName} 文件 ${colKey} 字段 max 类型错误，必须为 null 或数字`);
                    hasError = true;
                }
                if (field.detail !== undefined && typeof field.detail !== "string") {
                    Logger.warn(`${tablePrefix}${fileName} 文件 ${colKey} 字段 detail 类型错误，必须为字符串`);
                    hasError = true;
                }
                if (field.index !== undefined && typeof field.index !== "boolean") {
                    Logger.warn(`${tablePrefix}${fileName} 文件 ${colKey} 字段 index 类型错误，必须为布尔值`);
                    hasError = true;
                }
                if (field.unique !== undefined && typeof field.unique !== "boolean") {
                    Logger.warn(`${tablePrefix}${fileName} 文件 ${colKey} 字段 unique 类型错误，必须为布尔值`);
                    hasError = true;
                }
                if (field.nullable !== undefined && typeof field.nullable !== "boolean") {
                    Logger.warn(`${tablePrefix}${fileName} 文件 ${colKey} 字段 nullable 类型错误，必须为布尔值`);
                    hasError = true;
                }
                if (field.unsigned !== undefined && typeof field.unsigned !== "boolean") {
                    Logger.warn(`${tablePrefix}${fileName} 文件 ${colKey} 字段 unsigned 类型错误，必须为布尔值`);
                    hasError = true;
                }
                if (field.regexp !== undefined && field.regexp !== null && typeof field.regexp !== "string") {
                    Logger.warn(`${tablePrefix}${fileName} 文件 ${colKey} 字段 regexp 类型错误，必须为 null 或字符串`);
                    hasError = true;
                }

                const { name: fieldName, type: fieldType, min: fieldMin, max: fieldMax, default: fieldDefault } = field;

                // 字段名称必须为中文、数字、字母、下划线、短横线、空格
                if (!FIELD_NAME_REGEX.test(fieldName)) {
                    Logger.warn(`${tablePrefix}${fileName} 文件 ${colKey} 字段名称 "${fieldName}" 格式错误，` + `必须为中文、数字、字母、下划线、短横线、空格`);
                    hasError = true;
                }

                // 字段类型必须为string,number,text,array_string,array_text之一
                if (!FIELD_TYPE_SET.has(fieldType)) {
                    Logger.warn(`${tablePrefix}${fileName} 文件 ${colKey} 字段类型 "${fieldType}" 格式错误，` + `必须为${FIELD_TYPES.join("、")}之一`);
                    hasError = true;
                }

                // unsigned 仅对 number 类型有效（且仅 MySQL 语义上生效）
                if (fieldType !== "number" && field.unsigned !== undefined) {
                    Logger.warn(`${tablePrefix}${fileName} 文件 ${colKey} 字段类型为 ${fieldType}，不允许设置 unsigned（仅 number 类型有效）`);
                    hasError = true;
                }

                // 约束：unique 与 index 不能同时为 true（否则会重复索引），必须阻断启动。
                if (field.unique === true && field.index === true) {
                    Logger.warn(`${tablePrefix}${fileName} 文件 ${colKey} 同时设置了 unique=true 和 index=true，` + `unique 和 index 不能同时设置，请删除其一（否则会创建重复索引）`);
                    hasError = true;
                }

                // 约束：当最小值与最大值均为数字时，要求最小值 <= 最大值
                if (fieldMin !== undefined && fieldMax !== undefined && fieldMin !== null && fieldMax !== null) {
                    if (fieldMin > fieldMax) {
                        Logger.warn(`${tablePrefix}${fileName} 文件 ${colKey} 最小值 "${fieldMin}" 不能大于最大值 "${fieldMax}"`);
                        hasError = true;
                    }
                }

                // 类型联动校验 + 默认值规则
                if (fieldType === "text" || fieldType === "array_text" || fieldType === "array_number_text") {
                    // text / array_text / array_number_text：min/max 必须为 null，默认值必须为 null，且不支持索引/唯一约束
                    if (fieldMin !== undefined && fieldMin !== null) {
                        Logger.warn(`${tablePrefix}${fileName} 文件 ${colKey} 的 ${fieldType} 类型最小值应为 null，当前为 "${fieldMin}"`);
                        hasError = true;
                    }
                    if (fieldMax !== undefined && fieldMax !== null) {
                        Logger.warn(`${tablePrefix}${fileName} 文件 ${colKey} 的 ${fieldType} 类型最大长度应为 null，当前为 "${fieldMax}"`);
                        hasError = true;
                    }
                    if (fieldDefault !== undefined && fieldDefault !== null) {
                        Logger.warn(`${tablePrefix}${fileName} 文件 ${colKey} 为 ${fieldType} 类型，默认值必须为 null，当前为 "${fieldDefault}"`);
                        hasError = true;
                    }

                    if (field.index === true) {
                        Logger.warn(`${tablePrefix}${fileName} 文件 ${colKey} 为 ${fieldType} 类型，不支持创建索引（index=true 无效）`);
                        hasError = true;
                    }
                    if (field.unique === true) {
                        Logger.warn(`${tablePrefix}${fileName} 文件 ${colKey} 为 ${fieldType} 类型，不支持唯一约束（unique=true 无效）`);
                        hasError = true;
                    }
                } else if (fieldType === "string" || fieldType === "array_string" || fieldType === "array_number_string") {
                    // 约束：string/array_*_string 必须声明 max。
                    // 说明：array_*_string 的 max 表示“单个元素字符串长度”，不是数组元素数量。
                    if (fieldMax === undefined || fieldMax === null || typeof fieldMax !== "number") {
                        Logger.warn(`${tablePrefix}${fileName} 文件 ${colKey} 为 ${fieldType} 类型，` + `必须设置 max 且类型为数字；其中 array_*_string 的 max 表示单个元素长度，当前为 "${fieldMax}"`);
                        hasError = true;
                    } else if (fieldMax > MAX_VARCHAR_LENGTH) {
                        Logger.warn(`${tablePrefix}${fileName} 文件 ${colKey} 最大长度 ${fieldMax} 越界，` + `${fieldType} 类型长度必须在 1..${MAX_VARCHAR_LENGTH} 范围内`);
                        hasError = true;
                    }
                } else if (fieldType === "number") {
                    // number 类型：default 如果存在，必须为 null 或 number
                    if (fieldDefault !== undefined && fieldDefault !== null && typeof fieldDefault !== "number") {
                        Logger.warn(`${tablePrefix}${fileName} 文件 ${colKey} 为 number 类型，` + `默认值必须为数字或 null，当前为 "${fieldDefault}"`);
                        hasError = true;
                    }
                }
            }
        } catch (error: any) {
            Logger.error({ msg: `${tablePrefix}${item.fileName} 解析失败`, err: error });
            hasError = true;
        }
    }

    if (hasError) {
        throw new Error("表结构检查失败");
    }
}
