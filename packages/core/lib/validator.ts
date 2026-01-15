/**
 * 数据验证器 - Befly 项目专用
 * 纯静态类设计，简洁易用
 */

import type { JsonValue } from "../types/common";
import type { FieldDefinition, ValidateResult, SingleResult } from "../types/validate";

import { RegexAliases, getCompiledRegex } from "../configs/presetRegexp";
import { normalizeFieldDefinition } from "../utils/normalizeFieldDefinition";
import { isPlainObject } from "../utils/util";

const INPUT_TYPE_SET = new Set(["number", "integer", "string", "char", "array", "array_number", "array_integer", "json", "json_number", "json_integer"]);

function isRegexInput(input: string): boolean {
    if (input.startsWith("@")) return true;
    return /[\\^$.*+?()[\]{}]/.test(input);
}

function isEnumInput(input: string): boolean {
    return input.includes("|") && !isRegexInput(input);
}

function isJsonPrimitive(value: unknown): value is string | number | boolean | null {
    if (value === null) return true;
    return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== "object") return false;
    if (value instanceof Date) return false;
    if (Array.isArray(value)) return false;
    return true;
}

function isJsonStructure(value: unknown): boolean {
    return Array.isArray(value) || isJsonObject(value);
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function isIntegerNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value);
}

function checkJsonLeaves(value: unknown, rule: "number" | "integer"): boolean {
    if (isJsonPrimitive(value)) {
        if (rule === "number") return isFiniteNumber(value);
        return isIntegerNumber(value);
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            if (!checkJsonLeaves(item, rule)) return false;
        }
        return true;
    }

    if (isJsonObject(value)) {
        for (const v of Object.values(value)) {
            if (v === undefined) continue;
            if (!checkJsonLeaves(v, rule)) return false;
        }
        return true;
    }

    return false;
}

/**
 * 验证器类
 *
 * @example
 * const result = Validator.validate(data, rules, ['email', 'name']);
 * if (result.failed) {
 *     console.log(result.firstError);
 *     console.log(result.errors);
 *     console.log(result.errorFields);
 * }
 *
 * const single = Validator.single(value, fieldDef);
 * if (!single.error) {
 *     console.log(single.value);
 * }
 */
export class Validator {
    /**
     * 验证数据对象
     */
    static validate(data: unknown, rules: unknown, required: string[] = []): ValidateResult {
        const fieldErrors: Record<string, string> = {};

        // 参数检查
        if (!isPlainObject(data)) {
            return this.buildResult({ _error: "数据必须是对象格式" });
        }
        if (!isPlainObject(rules)) {
            return this.buildResult({ _error: "验证规则必须是对象格式" });
        }

        const dataRecord = data;
        const rulesRecord = rules;

        // 检查必填字段
        for (const field of required) {
            const value = dataRecord[field];
            if (value === undefined || value === null) {
                const rawRule = rulesRecord[field];
                const label = isPlainObject(rawRule) && typeof rawRule["name"] === "string" ? rawRule["name"] : field;
                fieldErrors[field] = `${label}为必填项`;
            }
        }

        // 验证有值的字段
        for (const [field, rawRule] of Object.entries(rulesRecord)) {
            if (fieldErrors[field]) continue;
            // 字段值为 undefined 时跳过验证（除非是必填字段，但必填字段已在上面检查过）
            if (dataRecord[field] === undefined && !required.includes(field)) continue;

            if (!isPlainObject(rawRule)) {
                fieldErrors[field] = `${field}验证规则必须是对象格式`;
                continue;
            }

            const ruleName = rawRule["name"];
            const ruleType = rawRule["type"];
            if (typeof ruleName !== "string" || typeof ruleType !== "string") {
                fieldErrors[field] = `${field}验证规则无效`;
                continue;
            }

            const rule: FieldDefinition = {
                name: ruleName,
                type: ruleType
            };

            const input = rawRule["input"];
            if (typeof input === "string") rule.input = input;

            const min = rawRule["min"];
            if (typeof min === "number" || min === null) rule.min = min;

            const max = rawRule["max"];
            if (typeof max === "number" || max === null) rule.max = max;

            const def = rawRule["default"];
            if (def === null || typeof def === "string" || typeof def === "number" || typeof def === "boolean" || Array.isArray(def) || isPlainObject(def)) {
                rule.default = def as JsonValue;
            }

            const detail = rawRule["detail"];
            if (typeof detail === "string") rule.detail = detail;

            const index = rawRule["index"];
            if (typeof index === "boolean") rule.index = index;

            const unique = rawRule["unique"];
            if (typeof unique === "boolean") rule.unique = unique;

            const nullable = rawRule["nullable"];
            if (typeof nullable === "boolean") rule.nullable = nullable;

            const unsigned = rawRule["unsigned"];
            if (typeof unsigned === "boolean") rule.unsigned = unsigned;

            const error = this.checkField(dataRecord[field], rule, field);
            if (error) fieldErrors[field] = error;
        }

        return this.buildResult(fieldErrors);
    }

    /**
     * 验证单个值（带类型转换）
     */
    static single(value: unknown, fieldDef: FieldDefinition): SingleResult {
        const normalized = normalizeFieldDefinition(fieldDef);
        const type = normalized.type;
        const input = normalized.input;
        const defaultValue = normalized.default;

        // 处理空值
        if (value === undefined || value === null || value === "") {
            return { value: this.defaultFor(type, input, defaultValue), error: null };
        }

        // 类型转换
        const converted = this.convert(value, input, type);
        if (converted.error) {
            return { value: null, error: converted.error };
        }

        // 规则验证
        const error = this.checkRule(converted.value, fieldDef);
        if (error) {
            return { value: null, error: error };
        }

        return { value: converted.value as JsonValue, error: null };
    }

    // ========== 私有方法 ==========

    /** 构建结果对象 */
    private static buildResult(fieldErrors: Record<string, string>): ValidateResult {
        const errors = Object.values(fieldErrors);
        const errorFields = Object.keys(fieldErrors);
        const failed = errors.length > 0;

        return {
            code: failed ? 1 : 0,
            failed: failed,
            firstError: failed ? (errors[0] ?? null) : null,
            errors: errors,
            errorFields: errorFields,
            fieldErrors: fieldErrors
        };
    }

    /** 验证单个字段 */
    private static checkField(value: unknown, fieldDef: FieldDefinition, fieldName: string): string | null {
        const label = fieldDef.name || fieldName;

        const normalized = normalizeFieldDefinition(fieldDef);
        const converted = this.convert(value, normalized.input, normalized.type);
        if (converted.error) {
            return `${label}${converted.error}`;
        }

        const error = this.checkRule(converted.value, fieldDef);
        return error ? `${label}${error}` : null;
    }

    /** 类型转换 */
    private static convert(value: unknown, input: string, dbType: string): { value: unknown; error: string | null } {
        const normalizedInput = String(input || "").toLowerCase();

        if (!INPUT_TYPE_SET.has(normalizedInput) && isRegexInput(normalizedInput)) {
            return typeof value === "string" ? { value: value, error: null } : { value: null, error: "必须是字符串" };
        }

        if (!INPUT_TYPE_SET.has(normalizedInput) && isEnumInput(normalizedInput)) {
            return typeof value === "string" ? { value: value, error: null } : { value: null, error: "必须是字符串" };
        }

        switch (normalizedInput) {
            case "number": {
                if (isFiniteNumber(value)) return { value: value, error: null };
                if (typeof value === "string") {
                    const num = Number(value);
                    return Number.isFinite(num) ? { value: num, error: null } : { value: null, error: "必须是数字" };
                }
                return { value: null, error: "必须是数字" };
            }

            case "integer": {
                if (isIntegerNumber(value)) return { value: value, error: null };
                if (typeof value === "string") {
                    const num = Number(value);
                    return Number.isFinite(num) && Number.isInteger(num) ? { value: num, error: null } : { value: null, error: "必须是整数" };
                }
                return { value: null, error: "必须是整数" };
            }

            case "string": {
                if (typeof value === "string") {
                    if (String(dbType || "").toLowerCase() === "datetime") {
                        const trimmed = value.trim();
                        return { value: trimmed, error: null };
                    }
                    return { value: value, error: null };
                }
                if (String(dbType || "").toLowerCase() === "datetime") {
                    return { value: null, error: "必须是时间字符串" };
                }
                return { value: null, error: "必须是字符串" };
            }

            case "char":
                if (typeof value !== "string") return { value: null, error: "必须是字符串" };
                return value.length === 1 ? { value: value, error: null } : { value: null, error: "必须是单字符" };

            case "array":
                return Array.isArray(value) ? { value: value, error: null } : { value: null, error: "必须是数组" };

            case "array_number": {
                if (!Array.isArray(value)) return { value: null, error: "必须是数组" };
                for (const item of value) {
                    if (!isFiniteNumber(item)) return { value: null, error: "数组元素必须是数字" };
                }
                return { value: value, error: null };
            }

            case "array_integer": {
                if (!Array.isArray(value)) return { value: null, error: "必须是数组" };
                for (const item of value) {
                    if (!isIntegerNumber(item)) return { value: null, error: "数组元素必须是整数" };
                }
                return { value: value, error: null };
            }

            case "json":
                if (!isJsonStructure(value)) return { value: null, error: "必须是JSON对象或数组" };
                return { value: value, error: null };

            case "json_number":
                if (!isJsonStructure(value)) return { value: null, error: "必须是JSON对象或数组" };
                return checkJsonLeaves(value, "number") ? { value: value, error: null } : { value: null, error: "JSON值必须是数字" };

            case "json_integer":
                if (!isJsonStructure(value)) return { value: null, error: "必须是JSON对象或数组" };
                return checkJsonLeaves(value, "integer") ? { value: value, error: null } : { value: null, error: "JSON值必须是整数" };

            default: {
                // 兜底：若 dbType 为 datetime，仍需字符串，且支持 YYYY-MM-DD 补零
                if (String(dbType || "").toLowerCase() === "datetime") {
                    if (typeof value !== "string") return { value: null, error: "必须是时间字符串" };
                    const trimmed = value.trim();
                    return { value: trimmed, error: null };
                }
                return { value: value, error: null };
            }
        }
    }

    /** 规则验证 */
    private static checkRule(value: unknown, fieldDef: FieldDefinition): string | null {
        const normalized = normalizeFieldDefinition(fieldDef);
        const type = normalized.type;
        const input = normalized.input;
        const min = normalized.min;
        const max = normalized.max;

        const normalizedInput = String(input || "").toLowerCase();
        const isRegex = !INPUT_TYPE_SET.has(normalizedInput) && isRegexInput(normalizedInput);
        const isEnum = !INPUT_TYPE_SET.has(normalizedInput) && isEnumInput(normalizedInput);

        if (normalizedInput === "number" || normalizedInput === "integer") {
            if (typeof value !== "number") return normalizedInput === "integer" ? "必须是整数" : "必须是数字";
            if (min !== null && value < min) return `不能小于${min}`;
            if (max !== null && max > 0 && value > max) return `不能大于${max}`;
        } else if (normalizedInput === "string" || normalizedInput === "char" || isRegex || isEnum) {
            if (typeof value !== "string") return "必须是字符串";
            if (normalizedInput === "char" && value.length !== 1) return "必须是单字符";
            if (min !== null && value.length < min) return `长度不能少于${min}个字符`;
            if (max !== null && max > 0 && value.length > max) return `长度不能超过${max}个字符`;

            if (isRegex) {
                const regex = this.resolveRegex(normalizedInput);
                if (!this.testRegex(regex, value)) return "格式不正确";
            }

            if (isEnum) {
                const enums = normalizedInput
                    .split("|")
                    .map((item) => item.trim())
                    .filter((item) => item !== "");
                if (!enums.includes(value)) return "值不在枚举范围内";
            }
        } else if (normalizedInput === "array" || normalizedInput === "array_number" || normalizedInput === "array_integer") {
            if (!Array.isArray(value)) return "必须是数组";
            if (min !== null && value.length < min) return `至少需要${min}个元素`;
            if (max !== null && max > 0 && value.length > max) return `最多只能有${max}个元素`;
        } else if (normalizedInput === "json" || normalizedInput === "json_number" || normalizedInput === "json_integer") {
            if (!isJsonStructure(value)) return "必须是JSON对象或数组";
        }

        if (String(type || "").toLowerCase() === "datetime") {
            if (typeof value !== "string") return "必须是时间字符串";
            if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return "格式不正确";

            const [datePart, timePart] = value.split(" ");
            if (typeof datePart !== "string" || typeof timePart !== "string") return "格式不正确";

            const [yStr, mStr, dStr] = datePart.split("-");
            const [hhStr, mmStr, ssStr] = timePart.split(":");

            const year = Number(yStr);
            const month = Number(mStr);
            const day = Number(dStr);
            const hh = Number(hhStr);
            const mm = Number(mmStr);
            const ss = Number(ssStr);

            if (!Number.isInteger(year) || year < 1000 || year > 9999) return "格式不正确";
            if (!Number.isInteger(month) || month < 1 || month > 12) return "格式不正确";
            if (!Number.isInteger(day) || day < 1) return "格式不正确";
            if (!Number.isInteger(hh) || hh < 0 || hh > 23) return "格式不正确";
            if (!Number.isInteger(mm) || mm < 0 || mm > 59) return "格式不正确";
            if (!Number.isInteger(ss) || ss < 0 || ss > 59) return "格式不正确";

            const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
            const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            const maxDay = daysInMonth[month - 1] ?? 0;
            if (day > maxDay) return "格式不正确";
        }
        return null;
    }

    /** 解析正则别名 */
    private static resolveRegex(pattern: string): string {
        if (pattern.startsWith("@")) {
            const key = pattern.substring(1) as keyof typeof RegexAliases;
            return RegexAliases[key] || pattern;
        }
        return pattern;
    }

    /** 测试正则 */
    private static testRegex(pattern: string, value: string): boolean {
        try {
            return getCompiledRegex(pattern).test(value);
        } catch {
            return false;
        }
    }

    /** 获取默认值 */
    private static defaultFor(type: string, input: string, defaultValue: JsonValue | null | undefined): JsonValue {
        // 如果字段定义了默认值，则使用字段默认值（优先级最高）
        if (defaultValue !== null && defaultValue !== undefined) {
            // 数组默认值
            if ((input === "array" || input === "array_number" || input === "array_integer") && typeof defaultValue === "string") {
                if (defaultValue === "[]") return [];
                try {
                    const parsed = JSON.parse(defaultValue);
                    return Array.isArray(parsed) ? parsed : [];
                } catch {
                    return [];
                }
            }
            // 数字默认值
            if ((input === "number" || input === "integer") && typeof defaultValue === "string") {
                const num = Number(defaultValue);
                return isNaN(num) ? 0 : num;
            }
            return defaultValue;
        }

        // 类型默认值（字段未定义 default 时使用）
        const normalizedType = String(type || "").toLowerCase();
        if (normalizedType === "datetime" || normalizedType === "json") {
            return null;
        }

        const normalizedInput = String(input || "").toLowerCase();
        if (normalizedInput === "json" || normalizedInput === "json_number" || normalizedInput === "json_integer") {
            return null;
        }

        switch (String(input || "").toLowerCase()) {
            case "number":
            case "integer":
                return 0;
            case "array":
            case "array_number":
            case "array_integer":
                return [];
            default:
                return "";
        }
    }
}
