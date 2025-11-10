/**
 * 表规则检查器 - TypeScript 版本
 * 验证表定义文件的格式和规则
 */

import { basename, relative } from 'pathe';
import { existsSync } from 'node:fs';
import { isPlainObject } from 'es-toolkit/compat';
import { Logger } from './lib/logger.js';
import { projectTableDir, projectApiDir } from './paths.js';
import { scanAddons, getAddonDir, addonDirExists } from './util.js';
import type { FieldDefinition } from './types/common.d.ts';

/**
 * 表文件信息接口
 */
interface TableFileInfo {
    /** 表文件路径 */
    file: string;
    /** 文件类型：project（项目）或 addon（组件） */
    type: 'project' | 'addon';
    /** 如果是 addon 类型，记录 addon 名称 */
    addonName?: string;
}

/**
 * 保留字段列表
 */
const RESERVED_FIELDS = ['id', 'created_at', 'updated_at', 'deleted_at', 'state'] as const;

/**
 * 允许的字段类型
 */
const FIELD_TYPES = ['string', 'number', 'text', 'array_string', 'array_text'] as const;

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
export const checkTable = async function (): Promise<boolean> {
    try {
        const tablesGlob = new Bun.Glob('*.json');

        // 收集所有表文件
        const allTableFiles: TableFileInfo[] = [];

        // 收集项目表字段定义文件
        for await (const file of tablesGlob.scan({
            cwd: projectTableDir,
            absolute: true,
            onlyFiles: true
        })) {
            allTableFiles.push({
                file: file,
                typeCode: 'project',
                typeName: '项目'
            });
        }

        // 收集 addon 表字段定义文件
        const addons = scanAddons();
        for (const addonName of addons) {
            const addonTablesDir = getAddonDir(addonName, 'tables');

            for await (const file of tablesGlob.scan({
                cwd: addonTablesDir,
                absolute: true,
                onlyFiles: true
            })) {
                allTableFiles.push({
                    file: file,
                    typeCode: 'addon',
                    typeName: `组件${addonName}`,
                    addonName: addonName
                });
            }
        }

        // 合并进行验证逻辑
        for (const item of allTableFiles) {
            const fileName = basename(item.file);
            const fileBaseName = basename(item.file, '.json');

            try {
                // 1) 文件名小驼峰校验
                if (!LOWER_CAMEL_CASE_REGEX.test(fileBaseName)) {
                    Logger.warn(`${item.typeName}表 ${fileName} 文件名必须使用小驼峰命名（例如 testCustomers.json）`);
                    continue;
                }

                // 动态导入 JSON 文件
                const tableModule = await import(item.file, { with: { type: 'json' } });
                const table = tableModule.default;

                // 检查 table 中的每个验证规则
                for (const [colKey, fieldDef] of Object.entries(table)) {
                    if (typeof fieldDef !== 'object' || fieldDef === null || Array.isArray(fieldDef)) {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 规则必须为对象`);
                        continue;
                    }

                    // 检查是否使用了保留字段
                    if (RESERVED_FIELDS.includes(colKey as any)) {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件包含保留字段 ${colKey}，` + `不能在表定义中使用以下字段: ${RESERVED_FIELDS.join(', ')}`);
                    }

                    // 直接使用字段对象
                    const field = fieldDef as FieldDefinition;

                    // 检查必填字段：name, type, min, max
                    if (!field.name || typeof field.name !== 'string') {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 缺少必填字段 name 或类型错误`);
                        continue;
                    }
                    if (!field.type || typeof field.type !== 'string') {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 缺少必填字段 type 或类型错误`);
                        continue;
                    }
                    if (field.min === undefined) {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 缺少必填字段 min`);
                        continue;
                    }
                    if (field.max === undefined) {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 缺少必填字段 max`);
                        continue;
                    }

                    // 检查可选字段的类型
                    if (field.detail !== undefined && typeof field.detail !== 'string') {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 字段 detail 类型错误，必须为字符串`);
                    }
                    if (field.index !== undefined && typeof field.index !== 'boolean') {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 字段 index 类型错误，必须为布尔值`);
                    }
                    if (field.unique !== undefined && typeof field.unique !== 'boolean') {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 字段 unique 类型错误，必须为布尔值`);
                    }
                    if (field.nullable !== undefined && typeof field.nullable !== 'boolean') {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 字段 nullable 类型错误，必须为布尔值`);
                    }
                    if (field.unsigned !== undefined && typeof field.unsigned !== 'boolean') {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 字段 unsigned 类型错误，必须为布尔值`);
                    }
                    if (field.regexp !== undefined && field.regexp !== null && typeof field.regexp !== 'string') {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 字段 regexp 类型错误，必须为 null 或字符串`);
                    }

                    const { name: fieldName, type: fieldType, min: fieldMin, max: fieldMax, default: fieldDefault, index: fieldIndex, regexp: fieldRegexp } = field;

                    // 第1个值：名称必须为中文、数字、字母、下划线、短横线、空格
                    if (!FIELD_NAME_REGEX.test(fieldName)) {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 字段名称 "${fieldName}" 格式错误，` + `必须为中文、数字、字母、下划线、短横线、空格`);
                    }

                    // 第2个值：字段类型必须为string,number,text,array_string,array_text之一
                    if (!FIELD_TYPES.includes(fieldType as any)) {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 字段类型 "${fieldType}" 格式错误，` + `必须为${FIELD_TYPES.join('、')}之一`);
                    }

                    // 第3/4个值：需要是 null 或 数字
                    if (!(fieldMin === null || typeof fieldMin === 'number')) {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 最小值 "${fieldMin}" 格式错误，必须为null或数字`);
                    }
                    if (!(fieldMax === null || typeof fieldMax === 'number')) {
                        Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 最大值 "${fieldMax}" 格式错误，必须为null或数字`);
                    }

                    // 约束：当最小值与最大值均为数字时，要求最小值 <= 最大值
                    if (fieldMin !== null && fieldMax !== null) {
                        if (fieldMin > fieldMax) {
                            Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 最小值 "${fieldMin}" 不能大于最大值 "${fieldMax}"`);
                        }
                    }

                    // 第4个值与类型联动校验 + 默认值规则
                    if (fieldType === 'text') {
                        // text：min/max 必须为 null，默认值必须为 null
                        if (fieldMin !== null) {
                            Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 的 text 类型最小值必须为 null，当前为 "${fieldMin}"`);
                        }
                        if (fieldMax !== null) {
                            Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 的 text 类型最大长度必须为 null，当前为 "${fieldMax}"`);
                        }
                        if (fieldDefault !== null) {
                            Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 为 text 类型，默认值必须为 null，当前为 "${fieldDefault}"`);
                        }
                    } else if (fieldType === 'string' || fieldType === 'array') {
                        if (fieldMax === null || typeof fieldMax !== 'number') {
                            Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 为 ${fieldType} 类型，` + `最大长度必须为数字，当前为 "${fieldMax}"`);
                        } else if (fieldMax > MAX_VARCHAR_LENGTH) {
                            Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 最大长度 ${fieldMax} 越界，` + `${fieldType} 类型长度必须在 1..${MAX_VARCHAR_LENGTH} 范围内`);
                        }
                    } else if (fieldType === 'number') {
                        // number 类型：default 如果存在，必须为 null 或 number
                        if (fieldDefault !== undefined && fieldDefault !== null && typeof fieldDefault !== 'number') {
                            Logger.warn(`${item.typeName}表 ${fileName} 文件 ${colKey} 为 number 类型，` + `默认值必须为数字或 null，当前为 "${fieldDefault}"`);
                        }
                    }
                }
            } catch (error: any) {
                Logger.error(`${item.typeName}表 ${fileName} 解析失败`, error);
            }
        }

        return true;
    } catch (error: any) {
        Logger.error('数据表定义检查过程中出错', error);
        return false;
    }
};

/**
 * 检查所有 API 定义
 */
export const checkApi = async function (): Promise<boolean> {
    try {
        const apiGlob = new Bun.Glob('**/*.ts');

        // 收集所有 API 文件
        const allApiFiles: Array<{ file: string; displayName: string }> = [];

        // 收集项目 API 文件
        if (existsSync(projectApiDir)) {
            for await (const file of apiGlob.scan({
                cwd: projectApiDir,
                onlyFiles: true,
                absolute: true
            })) {
                allApiFiles.push({
                    file: file,
                    displayName: '用户'
                });
            }
        }

        // 收集组件 API 文件
        const addons = scanAddons();
        for (const addon of addons) {
            if (!addonDirExists(addon, 'apis')) continue;
            const addonApiDir = getAddonDir(addon, 'apis');

            for await (const file of apiGlob.scan({
                cwd: addonApiDir,
                onlyFiles: true,
                absolute: true
            })) {
                allApiFiles.push({
                    file: file,
                    displayName: `组件${addon}`
                });
            }
        }

        // 合并进行验证逻辑
        for (const item of allApiFiles) {
            const fileName = basename(item.file).replace(/\.ts$/, '');
            const apiPath = relative(item.displayName === '用户' ? projectApiDir : getAddonDir(item.displayName.replace('组件', ''), 'apis'), item.file).replace(/\.ts$/, '');

            // 跳过以下划线开头的文件
            if (apiPath.indexOf('_') !== -1) continue;

            try {
                // Windows 下路径需要转换为正斜杠格式
                const filePath = item.file.replace(/\\/g, '/');
                const apiImport = await import(filePath);
                const api = apiImport.default;

                // 验证必填属性：name 和 handler
                if (typeof api.name !== 'string' || api.name.trim() === '') {
                    Logger.warn(`[${item.displayName}] 接口 ${apiPath} 的 name 属性必须是非空字符串`);
                    continue;
                }
                if (typeof api.handler !== 'function') {
                    Logger.warn(`[${item.displayName}] 接口 ${apiPath} 的 handler 属性必须是函数`);
                    continue;
                }

                // 验证可选属性的类型（如果提供了）
                if (api.method && !['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(api.method.toUpperCase())) {
                    Logger.warn(`[${item.displayName}] 接口 ${apiPath} 的 method 属性必须是有效的 HTTP 方法`);
                }
                if (api.auth !== undefined && typeof api.auth !== 'boolean') {
                    Logger.warn(`[${item.displayName}] 接口 ${apiPath} 的 auth 属性必须是布尔值 (true=需登录, false=公开)`);
                }
                if (api.fields && !isPlainObject(api.fields)) {
                    Logger.warn(`[${item.displayName}] 接口 ${apiPath} 的 fields 属性必须是对象`);
                }
                if (api.required && !Array.isArray(api.required)) {
                    Logger.warn(`[${item.displayName}] 接口 ${apiPath} 的 required 属性必须是数组`);
                }
                if (api.required && api.required.some((item: any) => typeof item !== 'string')) {
                    Logger.warn(`[${item.displayName}] 接口 ${apiPath} 的 required 属性必须是字符串数组`);
                }
            } catch (error: any) {
                Logger.error(`[${item.displayName}] 接口 ${apiPath} 解析失败`, error);
            }
        }

        return true;
    } catch (error: any) {
        Logger.error('API 定义检查过程中出错', error);
        return false;
    }
};
