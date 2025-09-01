import path from 'node:path';
import { Logger } from '../utils/logger.js';
import { parseFieldRule } from '../utils/index.js';
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
                    // 命名不合规，直接标记为无效文件
                    throw new Error('文件命名不符合小驼峰规范');
                }

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
                            const isValidNumber = (value) => value !== 'null' && !isNaN(parseFloat(value)) && isFinite(parseFloat(value));
                            if (!isValidNumber(maxStr)) {
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
                            const isValidNumber = (value) => value !== 'null' && !isNaN(parseFloat(value)) && isFinite(parseFloat(value));
                            if (!isValidNumber(maxStr)) {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${fieldName} 最大长度 "${maxStr}" 格式错误，array 类型必须为具体数字`);
                                fileValid = false;
                                continue;
                            }
                        } else {
                            // number 等其他：允许 null 或数字
                            const isValidMinMax = (value) => value === 'null' || (!isNaN(parseFloat(value)) && isFinite(parseFloat(value)));
                            if (!isValidMinMax(maxStr)) {
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
                            const isValidDefault = (value) => {
                                if (value === 'null') return true;
                                if (!isNaN(parseFloat(value)) && isFinite(parseFloat(value))) return true;
                                return true; // 其他情况视为字符串，都是有效的
                            };
                            if (!isValidDefault(defaultValue)) {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${fieldName} 默认值 "${defaultValue}" 格式错误，必须为null、字符串或数字`);
                                fileValid = false;
                                continue;
                            }
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
