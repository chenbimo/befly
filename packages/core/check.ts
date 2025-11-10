/**
 * 表规则检查器 - TypeScript 版本
 * 验证表定义文件的格式和规则
 */

import { basename } from 'pathe';
import { Logger } from './lib/logger.js';
import { projectTableDir } from './paths.js';
import { scanAddons, getAddonDir } from './util.js';
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
export const checkCore = async function (): Promise<boolean> {
    try {
        const tablesGlob = new Bun.Glob('*.json');

        // 统计信息
        let totalFiles = 0;
        let totalRules = 0;
        let validFiles = 0;
        let invalidFiles = 0;

        // 收集所有表文件
        const allTableFiles: TableFileInfo[] = [];

        // 收集项目表字段定义文件
        for await (const file of tablesGlob.scan({
            cwd: projectTableDir,
            absolute: true,
            onlyFiles: true
        })) {
            allTableFiles.push({ file: file, type: 'project' });
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
                allTableFiles.push({ file: file, type: 'addon', addonName: addonName });
            }
        }

        // 合并进行验证逻辑
        for (const { file, type, addonName } of allTableFiles) {
            totalFiles++;
            const fileName = basename(file);
            const fileBaseName = basename(file, '.json');
            const fileType = type === 'project' ? '项目' : `组件${addonName}`;

            try {
                // 1) 文件名小驼峰校验
                if (!LOWER_CAMEL_CASE_REGEX.test(fileBaseName)) {
                    Logger.warn(`${fileType}表 ${fileName} 文件名必须使用小驼峰命名（例如 testCustomers.json）`);
                    // 命名不合规，记录错误并计为无效文件，继续下一个文件
                    invalidFiles++;
                    continue;
                }

                // 读取并解析 JSON 文件
                const table = await Bun.file(file).json();
                let fileValid = true;
                let fileRules = 0;

                // 检查 table 中的每个验证规则
                for (const [colKey, fieldDef] of Object.entries(table)) {
                    if (typeof fieldDef !== 'object' || fieldDef === null || Array.isArray(fieldDef)) {
                        Logger.warn(`${fileType}表 ${fileName} 文件 ${colKey} 规则必须为对象`);
                        fileValid = false;
                        continue;
                    }

                    // 验证规则格式
                    fileRules++;
                    totalRules++;

                    // 检查是否使用了保留字段
                    if (RESERVED_FIELDS.includes(colKey as any)) {
                        Logger.warn(`${fileType}表 ${fileName} 文件包含保留字段 ${colKey}，` + `不能在表定义中使用以下字段: ${RESERVED_FIELDS.join(', ')}`);
                        fileValid = false;
                    }

                    // 直接使用字段对象
                    const field = fieldDef as FieldDefinition;

                    // 检查必填字段：name, type, min, max
                    if (!field.name || typeof field.name !== 'string') {
                        Logger.warn(`${fileType}表 ${fileName} 文件 ${colKey} 缺少必填字段 name 或类型错误`);
                        fileValid = false;
                        continue;
                    }
                    if (!field.type || typeof field.type !== 'string') {
                        Logger.warn(`${fileType}表 ${fileName} 文件 ${colKey} 缺少必填字段 type 或类型错误`);
                        fileValid = false;
                        continue;
                    }
                    if (field.min === undefined) {
                        Logger.warn(`${fileType}表 ${fileName} 文件 ${colKey} 缺少必填字段 min`);
                        fileValid = false;
                        continue;
                    }
                    if (field.max === undefined) {
                        Logger.warn(`${fileType}表 ${fileName} 文件 ${colKey} 缺少必填字段 max`);
                        fileValid = false;
                        continue;
                    }

                    // 检查可选字段的类型
                    if (field.detail !== undefined && typeof field.detail !== 'string') {
                        Logger.warn(`${fileType}表 ${fileName} 文件 ${colKey} 字段 detail 类型错误，必须为字符串`);
                        fileValid = false;
                    }
                    if (field.index !== undefined && typeof field.index !== 'boolean') {
                        Logger.warn(`${fileType}表 ${fileName} 文件 ${colKey} 字段 index 类型错误，必须为布尔值`);
                        fileValid = false;
                    }
                    if (field.unique !== undefined && typeof field.unique !== 'boolean') {
                        Logger.warn(`${fileType}表 ${fileName} 文件 ${colKey} 字段 unique 类型错误，必须为布尔值`);
                        fileValid = false;
                    }
                    if (field.nullable !== undefined && typeof field.nullable !== 'boolean') {
                        Logger.warn(`${fileType}表 ${fileName} 文件 ${colKey} 字段 nullable 类型错误，必须为布尔值`);
                        fileValid = false;
                    }
                    if (field.unsigned !== undefined && typeof field.unsigned !== 'boolean') {
                        Logger.warn(`${fileType}表 ${fileName} 文件 ${colKey} 字段 unsigned 类型错误，必须为布尔值`);
                        fileValid = false;
                    }
                    if (field.regexp !== undefined && field.regexp !== null && typeof field.regexp !== 'string') {
                        Logger.warn(`${fileType}表 ${fileName} 文件 ${colKey} 字段 regexp 类型错误，必须为 null 或字符串`);
                        fileValid = false;
                    }

                    const { name: fieldName, type: fieldType, min: fieldMin, max: fieldMax, default: fieldDefault, index: fieldIndex, regexp: fieldRegexp } = field;

                    // 第1个值：名称必须为中文、数字、字母、下划线、短横线、空格
                    if (!FIELD_NAME_REGEX.test(fieldName)) {
                        Logger.warn(`${fileType}表 ${fileName} 文件 ${colKey} 字段名称 "${fieldName}" 格式错误，` + `必须为中文、数字、字母、下划线、短横线、空格`);
                        fileValid = false;
                    }

                    // 第2个值：字段类型必须为string,number,text,array_string,array_text之一
                    if (!FIELD_TYPES.includes(fieldType as any)) {
                        Logger.warn(`${fileType}表 ${fileName} 文件 ${colKey} 字段类型 "${fieldType}" 格式错误，` + `必须为${FIELD_TYPES.join('、')}之一`);
                        fileValid = false;
                    }

                    // 第3/4个值：需要是 null 或 数字
                    if (!(fieldMin === null || typeof fieldMin === 'number')) {
                        Logger.warn(`${fileType}表 ${fileName} 文件 ${colKey} 最小值 "${fieldMin}" 格式错误，必须为null或数字`);
                        fileValid = false;
                    }
                    if (!(fieldMax === null || typeof fieldMax === 'number')) {
                        Logger.warn(`${fileType}表 ${fileName} 文件 ${colKey} 最大值 "${fieldMax}" 格式错误，必须为null或数字`);
                        fileValid = false;
                    }

                    // 约束：当最小值与最大值均为数字时，要求最小值 <= 最大值
                    if (fieldMin !== null && fieldMax !== null) {
                        if (fieldMin > fieldMax) {
                            Logger.warn(`${fileType}表 ${fileName} 文件 ${colKey} 最小值 "${fieldMin}" 不能大于最大值 "${fieldMax}"`);
                            fileValid = false;
                        }
                    }

                    // 第4个值与类型联动校验 + 默认值规则
                    if (fieldType === 'text') {
                        // text：min/max 必须为 null，默认值必须为 null
                        if (fieldMin !== null) {
                            Logger.warn(`${fileType}表 ${fileName} 文件 ${colKey} 的 text 类型最小值必须为 null，当前为 "${fieldMin}"`);
                            fileValid = false;
                        }
                        if (fieldMax !== null) {
                            Logger.warn(`${fileType}表 ${fileName} 文件 ${colKey} 的 text 类型最大长度必须为 null，当前为 "${fieldMax}"`);
                            fileValid = false;
                        }
                        if (fieldDefault !== null) {
                            Logger.warn(`${fileType}表 ${fileName} 文件 ${colKey} 为 text 类型，默认值必须为 null，当前为 "${fieldDefault}"`);
                            fileValid = false;
                        }
                    } else if (fieldType === 'string' || fieldType === 'array') {
                        if (fieldMax === null || typeof fieldMax !== 'number') {
                            Logger.warn(`${fileType}表 ${fileName} 文件 ${colKey} 为 ${fieldType} 类型，` + `最大长度必须为数字，当前为 "${fieldMax}"`);
                            fileValid = false;
                        } else if (fieldMax > MAX_VARCHAR_LENGTH) {
                            Logger.warn(`${fileType}表 ${fileName} 文件 ${colKey} 最大长度 ${fieldMax} 越界，` + `${fieldType} 类型长度必须在 1..${MAX_VARCHAR_LENGTH} 范围内`);
                            fileValid = false;
                        }
                    } else if (fieldType === 'number') {
                        // number 类型：default 如果存在，必须为 null 或 number
                        if (fieldDefault !== undefined && fieldDefault !== null && typeof fieldDefault !== 'number') {
                            Logger.warn(`${fileType}表 ${fileName} 文件 ${colKey} 为 number 类型，` + `默认值必须为数字或 null，当前为 "${fieldDefault}"`);
                            fileValid = false;
                        }
                    }
                }

                if (fileValid) {
                    validFiles++;
                    // Logger.info(`${fileType}表 ${fileName} 验证通过（${fileRules} 个字段）`);
                } else {
                    invalidFiles++;
                }
            } catch (error: any) {
                Logger.error(`${fileType}表 ${fileName} 解析失败`, error);
                invalidFiles++;
            }
        }

        // 输出统计信息
        // Logger.info(`  总文件数: ${totalFiles}`);
        // Logger.info(`  总规则数: ${totalRules}`);
        // Logger.info(`  通过文件: ${validFiles}`);
        // Logger.info(`  失败文件: ${invalidFiles}`);

        if (invalidFiles > 0) {
            Logger.error('表定义检查失败，请修复上述错误后重试');
            return false;
        }

        return true;
    } catch (error: any) {
        Logger.error('数据表定义检查过程中出错', error);
        return false;
    }
};
