/**
 * 表规则检查器 - TypeScript 版本
 * 验证表定义文件的格式和规则
 */

import path from 'node:path';
import { Logger } from '../utils/logger.js';
import { parseRule } from '../utils/index.js';
import { paths } from '../paths.js';
import { scanAddons, getAddonDir } from '../utils/addon.js';

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
 * @returns 检查是否通过
 */
export default async function (): Promise<boolean> {
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
            cwd: paths.projectTableDir,
            absolute: true,
            onlyFiles: true
        })) {
            allTableFiles.push({ file, type: 'project' });
        }

        // 收集 addon 表字段定义文件
        const addons = scanAddons();
        for (const addonName of addons) {
            const addonTablesDir = getAddonDir(addonName, 'tables');

            try {
                for await (const file of tablesGlob.scan({
                    cwd: addonTablesDir,
                    absolute: true,
                    onlyFiles: true
                })) {
                    allTableFiles.push({ file, type: 'addon', addonName });
                }
            } catch (error) {
                // addon 的 tables 目录可能不存在，跳过
            }
        }

        // 合并进行验证逻辑
        for (const { file, type, addonName } of allTableFiles) {
            totalFiles++;
            const fileName = path.basename(file);
            const fileBaseName = path.basename(file, '.json');
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
                for (const [colKey, rule] of Object.entries(table)) {
                    if (typeof rule !== 'string') {
                        Logger.warn(`${fileType}表 ${fileName} 文件 ${colKey} 规则必须为字符串`);
                        fileValid = false;
                        continue;
                    }

                    // 验证规则格式
                    try {
                        fileRules++;
                        totalRules++;

                        // 检查是否使用了保留字段
                        if (RESERVED_FIELDS.includes(colKey as any)) {
                            Logger.warn(`${fileType}表 ${fileName} 文件包含保留字段 ${colKey}，` + `不能在表定义中使用以下字段: ${RESERVED_FIELDS.join(', ')}`);
                            fileValid = false;
                        }

                        // 使用 parseRule 解析字段规则
                        let parsed;
                        try {
                            parsed = parseRule(rule);
                        } catch (error: any) {
                            Logger.warn(`${fileType}表 ${fileName} 文件 ${colKey} 字段规则解析失败：${error.message}`);
                            fileValid = false;
                            continue;
                        }

                        const { name: fieldName, type: fieldType, min: fieldMin, max: fieldMax, default: fieldDefault, index: fieldIndex, regex: fieldRegx } = parsed;

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

                        // 第6个值：是否创建索引必须为0或1
                        if (fieldIndex !== 0 && fieldIndex !== 1) {
                            Logger.warn(`${fileType}表 ${fileName} 文件 ${colKey} 索引标识 "${fieldIndex}" 格式错误，必须为0或1`);
                            fileValid = false;
                        }

                        // 第7个值：必须为null或正则表达式（parseRule已经验证过了）
                        // parseRule 已经将正则字符串转换为 RegExp 或 null，这里不需要再验证

                        // 第4个值与类型联动校验 + 默认值规则
                        if (fieldType === 'text') {
                            // text：min/max 必须为 null，默认值必须为 'null'
                            if (fieldMin !== null) {
                                Logger.warn(`${fileType}表 ${fileName} 文件 ${colKey} 的 text 类型最小值必须为 null，当前为 "${fieldMin}"`);
                                fileValid = false;
                            }
                            if (fieldMax !== null) {
                                Logger.warn(`${fileType}表 ${fileName} 文件 ${colKey} 的 text 类型最大长度必须为 null，当前为 "${fieldMax}"`);
                                fileValid = false;
                            }
                            if (fieldDefault !== 'null') {
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
                            if (fieldDefault !== 'null' && typeof fieldDefault !== 'number') {
                                Logger.warn(`${fileType}表 ${fileName} 文件 ${colKey} 为 number 类型，` + `默认值必须为数字或null，当前为 "${fieldDefault}"`);
                                fileValid = false;
                            }
                        }
                    } catch (error: any) {
                        // 单个字段规则解析失败已在上面处理
                    }
                }

                if (fileValid) {
                    validFiles++;
                    Logger.info(`${fileType}表 ${fileName} 验证通过（${fileRules} 个字段）`);
                } else {
                    invalidFiles++;
                }
            } catch (error: any) {
                Logger.error(`${fileType}表 ${fileName} 解析失败: ${error.message}`);
                invalidFiles++;
            }
        }

        // 输出统计信息
        Logger.info(`表定义检查完成：`);
        Logger.info(`  总文件数: ${totalFiles}`);
        Logger.info(`  总规则数: ${totalRules}`);
        Logger.info(`  通过文件: ${validFiles}`);
        Logger.info(`  失败文件: ${invalidFiles}`);

        if (invalidFiles > 0) {
            Logger.warn(`表定义检查失败，请修复上述错误后重试`);
            return false;
        } else {
            Logger.info(`所有表定义检查通过 ✓`);
            return true;
        }
    } catch (error: any) {
        Logger.error('数据表定义检查过程中出错:', error);
        return false;
    }
}
