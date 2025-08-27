import path from 'node:path';
import { Logger } from '../utils/logger.js';
import { parseFieldRule, validateFieldName, validateFieldType, validateMinMax, validateDefaultValue, validateIndex, validateRegex } from '../utils/index.js';
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
            const fileType = type === 'core' ? '内核' : '项目';

            try {
                // 读取并解析 JSON 文件
                const table = await Bun.file(file).json();
                let fileValid = true;
                let fileRules = 0;

                // 检查 table 中的每个验证规则
                for (const [fieldName, rule] of Object.entries(table)) {
                    fileRules++;
                    totalRules++;

                    // 检查是否使用了保留字段
                    if (reservedFields.includes(fieldName)) {
                        Logger.error(`${fileType}表 ${fileName} 文件包含保留字段 ${fieldName}，不能在表定义中使用以下字段: ${reservedFields.join(', ')}`);
                        fileValid = false;
                        continue;
                    }

                    // 验证规则格式
                    try {
                        const ruleParts = parseFieldRule(rule);

                        if (ruleParts.length !== 7) {
                            Logger.warn(`${fileType}表 ${fileName} 文件 ${fieldName} 验证规则错误，应包含 7 个部分，但包含 ${ruleParts.length} 个部分`);
                            fileValid = false;
                            continue;
                        }

                        const [name, type, minStr, maxStr, defaultValue, isIndexStr, regexConstraint] = ruleParts;

                        // 使用新的验证函数进行严格验证
                        // 第1个值：名称必须为中文、数字、字母
                        if (!validateFieldName(name)) {
                            Logger.error(`${fileType}表 ${fileName} 文件 ${fieldName} 名称 "${name}" 格式错误，必须为中文、数字、字母`);
                            fileValid = false;
                            continue;
                        }

                        // 第2个值：字段类型必须为string,number,text,array之一
                        if (!validateFieldType(type)) {
                            Logger.error(`${fileType}表 ${fileName} 文件 ${fieldName} 类型 "${type}" 格式错误，必须为string、number、text、array之一`);
                            fileValid = false;
                            continue;
                        }

                        // 第3个值：最小值必须为null或数字
                        if (!validateMinMax(minStr)) {
                            Logger.error(`${fileType}表 ${fileName} 文件 ${fieldName} 最小值 "${minStr}" 格式错误，必须为null或数字`);
                            fileValid = false;
                            continue;
                        }

                        // 第4个值与类型联动校验
                        if (type === 'text') {
                            // text 类型：不允许设置最小/最大长度与默认值（均需为 null）
                            if (minStr !== 'null') {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${fieldName} 的 text 类型最小值必须为 null，当前为 "${minStr}"`);
                                fileValid = false;
                                continue;
                            }
                            if (maxStr !== 'null') {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${fieldName} 的 text 类型最大长度必须为 null，当前为 "${maxStr}"`);
                                fileValid = false;
                                continue;
                            }
                        } else if (type === 'string') {
                            // string：最大长度必为具体数字，且 1..65535
                            if (maxStr === 'null' || !validateMinMax(maxStr)) {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${fieldName} 最大长度 "${maxStr}" 格式错误，string 类型必须为具体数字`);
                                fileValid = false;
                                continue;
                            }
                            const maxVal = parseInt(maxStr, 10);
                            if (!(maxVal > 0 && maxVal <= 65535)) {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${fieldName} 最大长度 ${maxStr} 越界，string 类型长度必须在 1..65535 范围内`);
                                fileValid = false;
                                continue;
                            }
                        } else if (type === 'array') {
                            // array：最大长度必为数字（用于JSON字符串长度限制）
                            if (maxStr === 'null' || !validateMinMax(maxStr)) {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${fieldName} 最大长度 "${maxStr}" 格式错误，array 类型必须为具体数字`);
                                fileValid = false;
                                continue;
                            }
                        } else {
                            // number 等其他：允许 null 或数字
                            if (!validateMinMax(maxStr)) {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${fieldName} 最大值 "${maxStr}" 格式错误，必须为null或数字`);
                                fileValid = false;
                                continue;
                            }
                        }

                        // 第5个值：默认值校验
                        if (type === 'text') {
                            // text 不允许默认值
                            if (defaultValue !== 'null') {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${fieldName} 为 text 类型，默认值必须为 null，当前为 "${defaultValue}"`);
                                fileValid = false;
                                continue;
                            }
                        } else {
                            if (!validateDefaultValue(defaultValue)) {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${fieldName} 默认值 "${defaultValue}" 格式错误，必须为null、字符串或数字`);
                                fileValid = false;
                                continue;
                            }
                        }

                        // 第6个值：是否创建索引必须为0或1
                        if (!validateIndex(isIndexStr)) {
                            Logger.error(`${fileType}表 ${fileName} 文件 ${fieldName} 索引标识 "${isIndexStr}" 格式错误，必须为0或1`);
                            fileValid = false;
                            continue;
                        }

                        // 第7个值：必须为null或正则表达式
                        if (!validateRegex(regexConstraint)) {
                            Logger.error(`${fileType}表 ${fileName} 文件 ${fieldName} 正则约束 "${regexConstraint}" 格式错误，必须为null或有效的正则表达式`);
                            fileValid = false;
                            continue;
                        }
                    } catch (error) {
                        Logger.error(`${fileType}表 ${fileName} 文件 ${fieldName} 验证规则解析失败: ${error.message}`);
                        fileValid = false;
                        continue;
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
