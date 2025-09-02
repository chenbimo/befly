import path from 'node:path';
import { Logger } from '../utils/logger.js';
import { parseRule } from '../utils/index.js';
import { __dirtables, getProjectDir } from '../system.js';

// 所有校验函数均复用 utils/index.js 导出的实现

export const checkTable = async () => {
    try {
        const tablesGlob = new Bun.Glob('*.json');

        // 统计信息
        let totalFiles = 0;
        let totalRules = 0;
        let validFiles = 0;
        let invalidFiles = 0;

        // 收集所有表文件
        const allTableFiles = [];
        const coreTableNames = new Set(); // 存储内核表文件名

        // 收集内核表字段定义文件
        for await (const file of tablesGlob.scan({
            cwd: __dirtables,
            absolute: true,
            onlyFiles: true
        })) {
            const fileName = path.basename(file, '.json');
            coreTableNames.add(fileName);
            allTableFiles.push({ file, type: 'core' });
        }

        // 收集项目表字段定义文件，并检查是否与内核表同名
        for await (const file of tablesGlob.scan({
            cwd: getProjectDir('tables'),
            absolute: true,
            onlyFiles: true
        })) {
            const fileName = path.basename(file, '.json');

            // 检查项目表是否与内核表同名
            if (coreTableNames.has(fileName)) {
                Logger.error(`项目表 ${fileName}.json 与内核表同名，项目表不能与内核表定义文件同名`);
                invalidFiles++;
                totalFiles++;
                continue;
            }

            allTableFiles.push({ file, type: 'project' });
        }

        // 保留字段列表
        const reservedFields = ['id', 'created_at', 'updated_at', 'deleted_at', 'state'];

        // 合并进行验证逻辑
        for (const { file, type } of allTableFiles) {
            totalFiles++;
            const fileName = path.basename(file);
            const fileBaseName = path.basename(file, '.json');
            const fileType = type === 'core' ? '内核' : '项目';

            try {
                // 1) 文件名小驼峰校验：必须以小写字母开头，后续可包含小写/数字，或多个 [大写+小写/数字] 片段
                //    示例：userTable、testCustomers、common
                const lowerCamelCaseRegex = /^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)*$/;
                if (!lowerCamelCaseRegex.test(fileBaseName)) {
                    Logger.error(`${fileType}表 ${fileName} 文件名必须使用小驼峰命名（例如 testCustomers.json）`);
                    // 命名不合规，按保留字段处理模式：记录错误并计为无效文件，继续下一个文件
                    invalidFiles++;
                    continue;
                }

                // 读取并解析 JSON 文件
                const table = await Bun.file(file).json();
                let fileValid = true;
                let fileRules = 0;

                // 检查 table 中的每个验证规则
                for (const [colKey, rule] of Object.entries(table)) {
                    // 验证规则格式
                    try {
                        fileRules++;
                        totalRules++;

                        // 检查是否使用了保留字段
                        if (reservedFields.includes(colKey)) {
                            Logger.error(`${fileType}表 ${fileName} 文件包含保留字段 ${colKey}，不能在表定义中使用以下字段: ${reservedFields.join(', ')}`);
                            fileValid = false;
                        }

                        const allParts = rule.split('⚡');

                        // 必须包含7个部分：显示名⚡类型⚡最小值⚡最大值⚡默认值⚡是否索引⚡正则约束
                        if (allParts.length !== 7) {
                            Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 字段规则格式错误，必须包含7个部分，当前包含${allParts.length}个部分`);
                            fileValid = false;
                        }

                        const [fieldName, fieldType, fieldMin, fieldMax, fieldDefault, fieldIndex, fieldRegx] = allParts;

                        // 第1个值：名称必须为中文、数字、字母
                        if (!/^[\u4e00-\u9fa5a-zA-Z0-9 _-]+$/.test(fieldName)) {
                            Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 字段名称 "${fieldName}" 格式错误，必须为中文、数字、字母、下划线、短横线`);
                            fileValid = false;
                        }

                        // 第2个值：字段类型必须为string,number,text,array之一
                        if (!['string', 'number', 'text', 'array'].includes(fieldType)) {
                            Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 字段类型 "${fieldType}" 格式错误，必须为string、number、text、array之一`);
                            fileValid = false;
                        }

                        // 第3/4个值：需要是 null 或 数字（并包含最小值<=最大值的约束）
                        if (!(fieldMin === 'null' || !Number.isNaN(Number(fieldMin)))) {
                            Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 最小值 "${fieldMin}" 格式错误，必须为null或数字`);
                            fileValid = false;
                        }
                        if (!(fieldMax === 'null' || !Number.isNaN(Number(fieldMax)))) {
                            Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 最大值 "${fieldMax}" 格式错误，必须为null或数字`);
                            fileValid = false;
                        }

                        // 约束：当最小值与最大值均为数字时，要求最小值 <= 最大值
                        if (fieldMin !== 'null' && fieldMax !== 'null') {
                            if (Number(fieldMin) > Number(fieldMax)) {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 最小值 "${fieldMin}" 不能大于最大值 "${fieldMax}"`);
                                fileValid = false;
                            }
                        }

                        // 第6个值：是否创建索引必须为0或1
                        if (fieldIndex !== '0' && fieldIndex !== '1') {
                            Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 索引标识 "${fieldIndex}" 格式错误，必须为0或1`);
                            fileValid = false;
                        }

                        // 第7个值：必须为null或正则表达式
                        if (fieldRegx !== 'null') {
                            try {
                                // 仅尝试构造以校验有效性
                                // eslint-disable-next-line no-new
                                new RegExp(fieldRegx);
                            } catch (_) {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 正则约束 "${fieldRegx}" 格式错误，必须为null或有效的正则表达式`);
                                fileValid = false;
                            }
                        }

                        // 第4个值与类型联动校验 + 默认值规则（精简实现）
                        if (fieldType === 'text') {
                            // text：min/max 必须为 null，默认值必须为 'null'
                            if (fieldMin !== 'null') {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 的 text 类型最小值必须为 null，当前为 "${fieldMin}"`);
                                fileValid = false;
                            }
                            if (fieldMax !== 'null') {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 的 text 类型最大长度必须为 null，当前为 "${fieldMax}"`);
                                fileValid = false;
                            }
                            if (fieldDefault !== 'null') {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 为 text 类型，默认值必须为 null，当前为 "${fieldDefault}"`);
                                fileValid = false;
                            }
                        } else if (fieldType === 'string' || fieldType === 'array') {
                            if (Number.isNaN(Number(fieldMax))) {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 为 string,array 类型，最大长度必须为数字，当前为 "${fieldMax}"`);
                                fileValid = false;
                            }
                            const maxVal = parseInt(fieldMax, 10);
                            if (maxVal > 65535) {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 最大长度 ${fieldMax} 越界，string,array 类型长度必须在 1..65535 范围内`);
                                fileValid = false;
                            }
                        } else if (fieldType === 'number') {
                            if (Number.isNaN(Number(fieldDefault))) {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 为 number 类型，默认值必须为数字，当前为 "${fieldDefault}"`);
                                fileValid = false;
                            }
                        }
                    } catch (error) {
                        Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 验证规则解析失败: ${error.message}`);
                        fileValid = false;
                    }
                }

                if (fileValid) {
                    validFiles++;
                } else {
                    invalidFiles++;
                }
            } catch (error) {
                Logger.error(`${fileType}表 ${fileName} 解析失败: ${error.message}`);
                invalidFiles++;
            }
        }

        if (invalidFiles > 0) {
            return false;
        } else {
            return true;
        }
    } catch (error) {
        Logger.error(`Tables 检查过程中出错:`, error);
        return false;
    }
};
