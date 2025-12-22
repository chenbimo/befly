// 类型导入
import type { FieldDefinition } from "../../types/validate.js";
import type { AddonInfo } from "../../utils/scanAddons.js";

import { existsSync } from "node:fs";

// 外部依赖
import { basename } from "pathe";

// 相对导入
import { Logger } from "../../lib/logger.js";
import { appTableDir } from "../../paths.js";
import { scanFiles } from "../../utils/scanFiles.js";

/**
 * 表文件信息接口
 */
interface TableFileInfo {
    /** 表文件路径 */
    file: string;
    /** 文件类型：app（项目）或 addon（组件） */
    type: "app" | "addon";
    /** 如果是 addon 类型，记录 addon 名称 */
    addonName?: string;
    /** 类型名称（用于日志） */
    typeName: string;
}

/**
 * 保留字段列表
 */
const RESERVED_FIELDS = ["id", "created_at", "updated_at", "deleted_at", "state"] as const;

/**
 * 允许的字段类型
 */
const FIELD_TYPES = ["string", "number", "text", "array_string", "array_text", "array_number_string", "array_number_text"] as const;

/**
 * 允许的字段属性列表
 */
const ALLOWED_FIELD_PROPERTIES = ["name", "type", "min", "max", "default", "detail", "index", "unique", "nullable", "unsigned", "regexp"] as const;

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
export async function checkTable(tables): Promise<void> {
    try {
        // 收集所有表文件
        let hasError = false;

        // 合并进行验证逻辑
        for (const item of tables) {
            try {
                const table = item.content || {};
                // 1) 文件名小驼峰校验
                if (!LOWER_CAMEL_CASE_REGEX.test(item.fileBaseName)) {
                    Logger.warn(`${item.typeName}表 ${item.fileName} 文件名必须使用小驼峰命名（例如 testCustomers.json）`);
                    hasError = true;
                    continue;
                }

                // 检查 table 中的每个验证规则
                for (const [colKey, fieldDef] of Object.entries(table)) {
                    if (typeof fieldDef !== "object" || fieldDef === null || Array.isArray(fieldDef)) {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 规则必须为对象`);
                        hasError = true;
                        continue;
                    }

                    // 检查是否使用了保留字段
                    if (RESERVED_FIELDS.includes(colKey as any)) {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件包含保留字段 ${colKey}，` + `不能在表定义中使用以下字段: ${RESERVED_FIELDS.join(", ")}`);
                        hasError = true;
                    }

                    // 直接使用字段对象
                    const field = fieldDef as FieldDefinition;

                    // 检查是否存在非法属性
                    const fieldKeys = Object.keys(field);
                    const illegalProps = fieldKeys.filter((key) => !ALLOWED_FIELD_PROPERTIES.includes(key as any));
                    if (illegalProps.length > 0) {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 包含非法属性: ${illegalProps.join(", ")}，` + `允许的属性为: ${ALLOWED_FIELD_PROPERTIES.join(", ")}`);
                        hasError = true;
                    }

                    // 检查必填字段：name, type
                    if (!field.name || typeof field.name !== "string") {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 缺少必填字段 name 或类型错误`);
                        hasError = true;
                        continue;
                    }
                    if (!field.type || typeof field.type !== "string") {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 缺少必填字段 type 或类型错误`);
                        hasError = true;
                        continue;
                    }

                    // 检查可选字段的类型
                    if (field.min !== undefined && !(field.min === null || typeof field.min === "number")) {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 字段 min 类型错误，必须为 null 或数字`);
                        hasError = true;
                    }
                    if (field.max !== undefined && !(field.max === null || typeof field.max === "number")) {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 字段 max 类型错误，必须为 null 或数字`);
                        hasError = true;
                    }
                    if (field.detail !== undefined && typeof field.detail !== "string") {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 字段 detail 类型错误，必须为字符串`);
                        hasError = true;
                    }
                    if (field.index !== undefined && typeof field.index !== "boolean") {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 字段 index 类型错误，必须为布尔值`);
                        hasError = true;
                    }
                    if (field.unique !== undefined && typeof field.unique !== "boolean") {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 字段 unique 类型错误，必须为布尔值`);
                        hasError = true;
                    }
                    if (field.nullable !== undefined && typeof field.nullable !== "boolean") {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 字段 nullable 类型错误，必须为布尔值`);
                        hasError = true;
                    }
                    if (field.unsigned !== undefined && typeof field.unsigned !== "boolean") {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 字段 unsigned 类型错误，必须为布尔值`);
                        hasError = true;
                    }
                    if (field.regexp !== undefined && field.regexp !== null && typeof field.regexp !== "string") {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 字段 regexp 类型错误，必须为 null 或字符串`);
                        hasError = true;
                    }

                    const { name: fieldName, type: fieldType, min: fieldMin, max: fieldMax, default: fieldDefault } = field;

                    // 字段名称必须为中文、数字、字母、下划线、短横线、空格
                    if (!FIELD_NAME_REGEX.test(fieldName)) {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 字段名称 "${fieldName}" 格式错误，` + `必须为中文、数字、字母、下划线、短横线、空格`);
                        hasError = true;
                    }

                    // 字段类型必须为string,number,text,array_string,array_text之一
                    if (!FIELD_TYPES.includes(fieldType as any)) {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 字段类型 "${fieldType}" 格式错误，` + `必须为${FIELD_TYPES.join("、")}之一`);
                        hasError = true;
                    }

                    // 检查 unique 和 index 冲突（警告但不阻断）
                    if (field.unique && field.index) {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 同时设置了 unique=true 和 index=true，` + `unique 约束会自动创建唯一索引，index=true 将被忽略以避免重复索引`);
                    }

                    // 约束：当最小值与最大值均为数字时，要求最小值 <= 最大值
                    if (fieldMin !== undefined && fieldMax !== undefined && fieldMin !== null && fieldMax !== null) {
                        if (fieldMin > fieldMax) {
                            Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 最小值 "${fieldMin}" 不能大于最大值 "${fieldMax}"`);
                            hasError = true;
                        }
                    }

                    // 类型联动校验 + 默认值规则
                    if (fieldType === "text") {
                        // text：min/max 应该为 null，默认值必须为 null
                        if (fieldMin !== undefined && fieldMin !== null) {
                            Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 的 text 类型最小值应为 null，当前为 "${fieldMin}"`);
                            hasError = true;
                        }
                        if (fieldMax !== undefined && fieldMax !== null) {
                            Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 的 text 类型最大长度应为 null，当前为 "${fieldMax}"`);
                            hasError = true;
                        }
                        if (fieldDefault !== undefined && fieldDefault !== null) {
                            Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 为 text 类型，默认值必须为 null，当前为 "${fieldDefault}"`);
                            hasError = true;
                        }
                    } else if (fieldType === "string" || fieldType === "array_string" || fieldType === "array_number_string") {
                        if (fieldMax !== undefined && (fieldMax === null || typeof fieldMax !== "number")) {
                            Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 为 ${fieldType} 类型，` + `最大长度必须为数字，当前为 "${fieldMax}"`);
                            hasError = true;
                        } else if (fieldMax !== undefined && fieldMax > MAX_VARCHAR_LENGTH) {
                            Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 最大长度 ${fieldMax} 越界，` + `${fieldType} 类型长度必须在 1..${MAX_VARCHAR_LENGTH} 范围内`);
                            hasError = true;
                        }
                    } else if (fieldType === "number") {
                        // number 类型：default 如果存在，必须为 null 或 number
                        if (fieldDefault !== undefined && fieldDefault !== null && typeof fieldDefault !== "number") {
                            Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 为 number 类型，` + `默认值必须为数字或 null，当前为 "${fieldDefault}"`);
                            hasError = true;
                        }
                    }
                }
            } catch (error: any) {
                Logger.error(`${item.typeName}表 ${fileName} 解析失败`, error);
                hasError = true;
            }
        }

        if (hasError) {
            throw new Error("表结构检查失败");
        }
    } catch (error: any) {
        Logger.error("数据表定义检查过程中出错", error);
        throw error;
    }
}
