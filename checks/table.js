import path from 'node:path';
import { Logger } from '../utils/logger.js';
import { parseFieldRule } from '../utils/util.js';
import { __dirtables, getProjectDir } from '../system.js';

// 验证字段名称是否为中文、数字、字母
const validateFieldName = (name) => {
    const nameRegex = /^[\u4e00-\u9fa5a-zA-Z0-9]+$/;
    return nameRegex.test(name);
};

// 验证字段类型是否为指定的四种类型之一
const validateFieldType = (type) => {
    const validTypes = ['string', 'number', 'text', 'array'];
    return validTypes.includes(type);
};

// 验证最小值/最大值是否为null或数字
const validateMinMax = (value) => {
    return value === 'null' || (!isNaN(parseFloat(value)) && isFinite(parseFloat(value)));
};

// 验证默认值是否为null、字符串或数字
const validateDefaultValue = (value) => {
    if (value === 'null') return true;
    // 检查是否为数字
    if (!isNaN(parseFloat(value)) && isFinite(parseFloat(value))) return true;
    // 其他情况视为字符串，都是有效的
    return true;
};

// 验证索引标识是否为0或1
const validateIndex = (value) => {
    return value === '0' || value === '1';
};

// 验证正则表达式是否有效
const validateRegex = (value) => {
    if (value === 'null') return true;
    try {
        new RegExp(value);
        return true;
    } catch (e) {
        return false;
    }
};

export default async () => {
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

                        // 第4个值：当类型为 string/array 时，最大长度必须为数字且不可为 null；其他类型允许为 null 或数字
                        if (type === 'string' || type === 'array') {
                            if (maxStr === 'null' || !validateMinMax(maxStr)) {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${fieldName} 最大长度 "${maxStr}" 格式错误，string/array 类型必须为具体数字`);
                                fileValid = false;
                                continue;
                            }
                        } else {
                            if (!validateMinMax(maxStr)) {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${fieldName} 最大值 "${maxStr}" 格式错误，必须为null或数字`);
                                fileValid = false;
                                continue;
                            }
                        }

                        // 第5个值：默认值必须为null、字符串或数字
                        if (!validateDefaultValue(defaultValue)) {
                            Logger.error(`${fileType}表 ${fileName} 文件 ${fieldName} 默认值 "${defaultValue}" 格式错误，必须为null、字符串或数字`);
                            fileValid = false;
                            continue;
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
