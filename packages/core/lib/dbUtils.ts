import type { WhereConditions } from "../types/common.js";

import { snakeCase } from "es-toolkit/string";

export class DbUtils {
    /**
     * 字段数组转下划线格式
     * 支持排除字段语法：['!password', '!token']
     *
     * 说明：exclude 模式需要表的所有字段名，因此通过 getTableColumns 回调获取
     */
    static async fieldsToSnake(table: string, fields: string[], getTableColumns: (table: string) => Promise<string[]>): Promise<string[]> {
        if (!fields || !Array.isArray(fields)) {
            return ["*"];
        }

        const classified = DbUtils.validateAndClassifyFields(fields);

        // 情况1：查询所有字段
        if (classified.type === "all") {
            return ["*"];
        }

        // 情况2：指定包含字段
        if (classified.type === "include") {
            return classified.fields.map((field) => {
                // 保留函数和特殊字段
                if (field.includes("(") || field.includes(" ")) {
                    return field;
                }
                return snakeCase(field);
            });
        }

        // 情况3：排除字段
        if (classified.type === "exclude") {
            const allColumns = await getTableColumns(table);
            const excludeSnakeFields = classified.fields.map((f) => snakeCase(f));

            const resultFields = allColumns.filter((col) => !excludeSnakeFields.includes(col));
            if (resultFields.length === 0) {
                throw new Error(`排除字段后没有剩余字段可查询。表: ${table}, 排除: ${excludeSnakeFields.join(", ")}`);
            }

            return resultFields;
        }

        return ["*"];
    }

    static validateAndClassifyFields(fields?: string[]): {
        type: "all" | "include" | "exclude";
        fields: string[];
    } {
        // 情况1：空数组或 undefined，表示查询所有
        if (!fields || fields.length === 0) {
            return { type: "all", fields: [] };
        }

        // 检测是否有星号（禁止）
        if (fields.some((f) => f === "*")) {
            throw new Error("fields 不支持 * 星号，请使用空数组 [] 或不传参数表示查询所有字段");
        }

        // 检测是否有空字符串或无效值
        if (fields.some((f) => !f || typeof f !== "string" || f.trim() === "")) {
            throw new Error("fields 不能包含空字符串或无效值");
        }

        // 统计包含字段和排除字段
        const includeFields = fields.filter((f) => !f.startsWith("!"));
        const excludeFields = fields.filter((f) => f.startsWith("!"));

        // 情况2：全部是包含字段
        if (includeFields.length > 0 && excludeFields.length === 0) {
            return { type: "include", fields: includeFields };
        }

        // 情况3：全部是排除字段
        if (excludeFields.length > 0 && includeFields.length === 0) {
            // 去掉感叹号前缀
            const cleanExcludeFields = excludeFields.map((f) => f.substring(1));
            return { type: "exclude", fields: cleanExcludeFields };
        }

        // 混用情况：报错
        throw new Error('fields 不能同时包含普通字段和排除字段（! 开头）。只能使用以下3种方式之一：\n1. 空数组 [] 或不传（查询所有）\n2. 全部指定字段 ["id", "name"]\n3. 全部排除字段 ["!password", "!token"]');
    }

    static orderByToSnake(orderBy: string[]): string[] {
        if (!orderBy || !Array.isArray(orderBy)) {
            return orderBy;
        }

        return orderBy.map((item) => {
            if (typeof item !== "string" || !item.includes("#")) {
                return item;
            }

            const [field, direction] = item.split("#");
            return `${snakeCase(field.trim())}#${direction.trim()}`;
        });
    }

    static processTableName(table: string): string {
        return snakeCase(table.trim());
    }

    static processJoinField(field: string): string {
        // 跳过函数、星号、已处理的字段
        if (field.includes("(") || field === "*" || field.startsWith("`")) {
            return field;
        }

        // 处理别名 AS
        if (field.toUpperCase().includes(" AS ")) {
            const parts = field.split(/\s+AS\s+/i);
            const fieldPart = parts[0].trim();
            const aliasPart = parts[1].trim();
            return `${DbUtils.processJoinField(fieldPart)} AS ${aliasPart}`;
        }

        // 处理表名.字段名
        if (field.includes(".")) {
            const parts = field.split(".");
            const tableName = parts[0];
            const fieldName = parts[1];
            return `${snakeCase(tableName)}.${snakeCase(fieldName)}`;
        }

        // 普通字段
        return snakeCase(field);
    }

    static processJoinWhereKey(key: string): string {
        // 保留逻辑操作符
        if (key === "$or" || key === "$and") {
            return key;
        }

        // 处理带操作符的字段名（如 user.userId$gt）
        if (key.includes("$")) {
            const lastDollarIndex = key.lastIndexOf("$");
            const fieldPart = key.substring(0, lastDollarIndex);
            const operator = key.substring(lastDollarIndex);

            if (fieldPart.includes(".")) {
                const parts = fieldPart.split(".");
                const tableName = parts[0];
                const fieldName = parts[1];
                return `${snakeCase(tableName)}.${snakeCase(fieldName)}${operator}`;
            }

            return `${snakeCase(fieldPart)}${operator}`;
        }

        // 处理表名.字段名
        if (key.includes(".")) {
            const parts = key.split(".");
            const tableName = parts[0];
            const fieldName = parts[1];
            return `${snakeCase(tableName)}.${snakeCase(fieldName)}`;
        }

        // 普通字段
        return snakeCase(key);
    }

    static processJoinWhere(where: any): any {
        if (!where || typeof where !== "object") {
            return where;
        }

        if (Array.isArray(where)) {
            return where.map((item) => DbUtils.processJoinWhere(item));
        }

        const result: any = {};
        for (const [key, value] of Object.entries(where)) {
            const newKey = DbUtils.processJoinWhereKey(key);

            if (key === "$or" || key === "$and") {
                result[newKey] = (value as any[]).map((item) => DbUtils.processJoinWhere(item));
            } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                result[newKey] = DbUtils.processJoinWhere(value);
            } else {
                result[newKey] = value;
            }
        }

        return result;
    }

    static processJoinOrderBy(orderBy: string[]): string[] {
        if (!orderBy || !Array.isArray(orderBy)) {
            return orderBy;
        }

        return orderBy.map((item) => {
            if (typeof item !== "string" || !item.includes("#")) {
                return item;
            }

            const [field, direction] = item.split("#");
            return `${DbUtils.processJoinField(field.trim())}#${direction.trim()}`;
        });
    }

    static addDefaultStateFilter(where: WhereConditions = {}, table?: string, hasJoins: boolean = false): WhereConditions {
        // 如果用户已经指定了 state 条件，优先使用用户的条件
        const hasStateCondition = Object.keys(where).some((key) => key.startsWith("state") || key.includes(".state"));

        if (hasStateCondition) {
            return where;
        }

        // JOIN 查询时需要指定主表名前缀避免歧义
        if (hasJoins && table) {
            const result: any = {};
            for (const [key, value] of Object.entries(where)) {
                result[key] = value;
            }
            result[`${table}.state$gt`] = 0;
            return result;
        }

        // 默认查询 state > 0 的数据
        const result: any = {};
        for (const [key, value] of Object.entries(where)) {
            result[key] = value;
        }
        result.state$gt = 0;
        return result;
    }

    /**
     * Where 条件键名转下划线格式（递归处理嵌套）
     * 支持操作符字段（如 userId$gt）和逻辑操作符（$or, $and）
     */
    static whereKeysToSnake(where: any): any {
        if (!where || typeof where !== "object") {
            return where;
        }

        // 处理数组（$or, $and 等）
        if (Array.isArray(where)) {
            return where.map((item) => DbUtils.whereKeysToSnake(item));
        }

        const result: any = {};
        for (const [key, value] of Object.entries(where)) {
            // 保留 $or, $and 等逻辑操作符
            if (key === "$or" || key === "$and") {
                result[key] = (value as any[]).map((item) => DbUtils.whereKeysToSnake(item));
                continue;
            }

            // 处理带操作符的字段名（如 userId$gt）
            if (key.includes("$")) {
                const lastDollarIndex = key.lastIndexOf("$");
                const fieldName = key.substring(0, lastDollarIndex);
                const operator = key.substring(lastDollarIndex);
                const snakeKey = snakeCase(fieldName) + operator;
                result[snakeKey] = value;
                continue;
            }

            // 普通字段：转换键名，递归处理值（支持嵌套对象）
            const snakeKey = snakeCase(key);
            if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                result[snakeKey] = DbUtils.whereKeysToSnake(value);
            } else {
                result[snakeKey] = value;
            }
        }

        return result;
    }

    /**
     * 序列化数组字段（写入数据库前）
     * 将数组类型的字段转换为 JSON 字符串
     */
    static serializeArrayFields(data: Record<string, any>): Record<string, any> {
        const serialized: Record<string, any> = {};

        for (const [key, value] of Object.entries(data)) {
            if (value === null || value === undefined) {
                serialized[key] = value;
                continue;
            }

            if (Array.isArray(value)) {
                serialized[key] = JSON.stringify(value);
                continue;
            }

            serialized[key] = value;
        }

        return serialized;
    }

    /**
     * 反序列化数组字段（从数据库读取后）
     * 将 JSON 字符串转换回数组
     */
    static deserializeArrayFields<T = any>(data: Record<string, any> | null): T | null {
        if (!data) {
            return null;
        }

        const deserialized: Record<string, any> = {};
        for (const [key, value] of Object.entries(data)) {
            deserialized[key] = value;
        }

        for (const [key, value] of Object.entries(deserialized)) {
            if (typeof value !== "string") {
                continue;
            }

            if (value.startsWith("[") && value.endsWith("]")) {
                try {
                    const parsed = JSON.parse(value);
                    if (Array.isArray(parsed)) {
                        deserialized[key] = parsed;
                    }
                } catch {
                    // 解析失败则保持原值
                }
            }
        }

        return deserialized as T;
    }
}
