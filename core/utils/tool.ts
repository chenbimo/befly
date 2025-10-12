/**
 * Tool 工具类 - TypeScript 版本
 * 提供数据处理的便捷方法
 */

import { omitFields } from './index.js';
import type { BeflyContext } from '../types/befly.js';

/**
 * 数据对象类型
 */
type DataObject = Record<string, any>;

/**
 * 工具类：通过构造函数注入 befly
 */
export class Tool {
    private befly: BeflyContext;

    /**
     * 构造函数
     * @param befly - Befly 上下文
     */
    constructor(befly: BeflyContext) {
        this.befly = befly;
    }

    /**
     * 处理更新数据
     * - 移除 id、created_at、deleted_at 字段
     * - 添加 updated_at 时间戳
     * @param data - 原始数据
     * @param now - 当前时间戳（可选）
     * @returns 处理后的数据
     */
    async updData(data: DataObject, now: number = Date.now()): Promise<DataObject> {
        const cleaned = omitFields(data ?? {}, ['id', 'created_at', 'deleted_at'], [undefined]);
        return { ...cleaned, updated_at: now };
    }

    /**
     * 处理插入数据
     * - 生成唯一 ID
     * - 添加 created_at 和 updated_at 时间戳
     * - 移除 undefined 字段
     * @param data - 原始数据（支持单个对象或数组）
     * @param now - 当前时间戳（可选）
     * @returns 处理后的数据
     */
    async insData(data: DataObject | DataObject[], now: number = Date.now()): Promise<DataObject | DataObject[]> {
        const genId = async (): Promise<number> => await this.befly.redis.genTimeID();

        if (Array.isArray(data)) {
            return await Promise.all(
                data.map(async (item) => ({
                    ...omitFields(item ?? {}, [], [undefined]),
                    id: await genId(),
                    created_at: now,
                    updated_at: now
                }))
            );
        } else {
            const cleaned = omitFields(data ?? {}, [], [undefined]);
            return {
                ...cleaned,
                id: await genId(),
                created_at: now,
                updated_at: now
            };
        }
    }

    /**
     * 处理删除数据（软删除）
     * - 设置 deleted_at 时间戳
     * - 添加 updated_at 时间戳
     * @param now - 当前时间戳（可选）
     * @returns 处理后的数据
     */
    async delData(now: number = Date.now()): Promise<DataObject> {
        return {
            deleted_at: now,
            updated_at: now,
            state: 0
        };
    }

    /**
     * 批量生成 ID
     * @param count - 生成数量
     * @returns ID 数组
     */
    async genIds(count: number): Promise<number[]> {
        const ids: number[] = [];
        for (let i = 0; i < count; i++) {
            ids.push(await this.befly.redis.genTimeID());
        }
        return ids;
    }

    /**
     * 清理数据对象
     * - 移除 undefined、null、空字符串
     * @param data - 原始数据
     * @param removeNull - 是否移除 null
     * @param removeEmptyString - 是否移除空字符串
     * @returns 清理后的数据
     */
    cleanData(data: DataObject, removeNull: boolean = true, removeEmptyString: boolean = true): DataObject {
        const result: DataObject = {};

        for (const [key, value] of Object.entries(data)) {
            // 跳过 undefined
            if (value === undefined) continue;

            // 跳过 null（如果配置）
            if (removeNull && value === null) continue;

            // 跳过空字符串（如果配置）
            if (removeEmptyString && value === '') continue;

            result[key] = value;
        }

        return result;
    }

    /**
     * 合并数据对象（深度合并）
     * @param target - 目标对象
     * @param sources - 源对象（可多个）
     * @returns 合并后的对象
     */
    mergeData(target: DataObject, ...sources: DataObject[]): DataObject {
        const result = { ...target };

        for (const source of sources) {
            for (const [key, value] of Object.entries(source)) {
                if (value !== undefined) {
                    result[key] = value;
                }
            }
        }

        return result;
    }

    /**
     * 提取指定字段
     * @param data - 原始数据
     * @param fields - 字段列表
     * @returns 提取后的数据
     */
    pickFields(data: DataObject, fields: string[]): DataObject {
        const result: DataObject = {};

        for (const field of fields) {
            if (field in data) {
                result[field] = data[field];
            }
        }

        return result;
    }

    /**
     * 排除指定字段
     * @param data - 原始数据
     * @param fields - 字段列表
     * @returns 排除后的数据
     */
    omitFields(data: DataObject, fields: string[]): DataObject {
        const result = { ...data };

        for (const field of fields) {
            delete result[field];
        }

        return result;
    }

    /**
     * 重命名字段
     * @param data - 原始数据
     * @param mapping - 字段映射 { oldKey: newKey }
     * @returns 重命名后的数据
     */
    renameFields(data: DataObject, mapping: Record<string, string>): DataObject {
        const result = { ...data };

        for (const [oldKey, newKey] of Object.entries(mapping)) {
            if (oldKey in result) {
                result[newKey] = result[oldKey];
                delete result[oldKey];
            }
        }

        return result;
    }

    /**
     * 转换字段类型
     * @param data - 原始数据
     * @param conversions - 转换规则 { field: 'number' | 'string' | 'boolean' }
     * @returns 转换后的数据
     */
    convertFields(data: DataObject, conversions: Record<string, 'number' | 'string' | 'boolean'>): DataObject {
        const result = { ...data };

        for (const [field, type] of Object.entries(conversions)) {
            if (field in result && result[field] !== null && result[field] !== undefined) {
                switch (type) {
                    case 'number':
                        result[field] = Number(result[field]);
                        break;
                    case 'string':
                        result[field] = String(result[field]);
                        break;
                    case 'boolean':
                        result[field] = Boolean(result[field]);
                        break;
                }
            }
        }

        return result;
    }
}
