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
                            continue;
                        }

                        const allParts = rule.split('⚡');

                        // 必须包含7个部分：显示名⚡类型⚡最小值⚡最大值⚡默认值⚡是否索引⚡正则约束
                        if (allParts.length !== 7) {
                            Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 字段规则格式错误，必须包含7个部分，当前包含${allParts.length}个部分`);
                            fileValid = false;
                            continue;
                        }

                        // 验证各个部分的格式
                        const [fieldName, fieldType, fieldMin, fieldMax, fieldDefault, fieldIndex, fieldRegx] = parseRule(rule);

                        // 第1个值：名称必须为中文、数字、字母
                        const nameRegex = /^[\u4e00-\u9fa5a-zA-Z0-9 _-]+$/;
                        if (!nameRegex.test(fieldName)) {
                            Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 字段名称 "${fieldName}" 格式错误，必须为中文、数字、字母、下划线、短横线`);
                            fileValid = false;
                            continue;
                        }

                        // 第2个值：字段类型必须为string,number,text,array之一
                        if (!['string', 'number', 'text', 'array'].includes(fieldType)) {
                            Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 字段类型 "${fieldType}" 格式错误，必须为string、number、text、array之一`);
                            fileValid = false;
                            continue;
                        }

                        // 第3/4个值：需要是 null 或 数字
                        if (!(fieldMin === 'null' || (!Number.isNaN(Number(fieldMin)) && isFinite(Number(fieldMin))))) {
                            Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 最小值 "${fieldMin}" 格式错误，必须为null或数字`);
                            fileValid = false;
                            continue;
                        }
                        if (!(fieldMax === 'null' || (!Number.isNaN(Number(fieldMax)) && isFinite(Number(fieldMax))))) {
                            Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 最大值 "${fieldMax}" 格式错误，必须为null或数字`);
                            fileValid = false;
                            continue;
                        }

                        // 约束：当最小值与最大值均为数字时，要求最小值 <= 最大值
                        const minIsNum = fieldMin !== 'null' && !Number.isNaN(Number(fieldMin));
                        const maxIsNum = fieldMax !== 'null' && !Number.isNaN(Number(fieldMax));
                        if (minIsNum && maxIsNum) {
                            const minNum = Number(fieldMin);
                            const maxNum = Number(fieldMax);
                            if (minNum > maxNum) {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 最小值 "${fieldMin}" 不能大于最大值 "${fieldMax}"`);
                                fileValid = false;
                                continue;
                            }
                        }

                        // 第5个值：默认值必须为null、字符串或数字（内联判断；字符串默认视为有效）
                        if (!(fieldDefault === 'null' || !Number.isNaN(Number(fieldDefault)) || typeof fieldDefault === 'string')) {
                            Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 默认值 "${fieldDefault}" 格式错误，必须为null、字符串或数字`);
                            fileValid = false;
                            continue;
                        }

                        // 第6个值：是否创建索引必须为0或1
                        if (!(fieldIndex === 0 || fieldIndex === 1 || fieldIndex === '0' || fieldIndex === '1')) {
                            Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 索引标识 "${fieldIndex}" 格式错误，必须为0或1`);
                            fileValid = false;
                            continue;
                        }

                        // 第7个值：必须为null或正则表达式（内联判断）
                        if (fieldRegx !== 'null') {
                            try {
                                // 仅尝试构造以校验有效性
                                // eslint-disable-next-line no-new
                                new RegExp(fieldRegx);
                            } catch (_) {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 正则约束 "${fieldRegx}" 格式错误，必须为null或有效的正则表达式`);
                                fileValid = false;
                                continue;
                            }
                        }

                        // 第4个值与类型联动校验
                        if (fieldType === 'text') {
                            // text 类型：不允许设置最小/最大长度与默认值（均需为 null）
                            if (fieldMin !== 'null') {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 的 text 类型最小值必须为 null，当前为 "${fieldMin}"`);
                                fileValid = false;
                                continue;
                            }
                            if (fieldMax !== 'null') {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 的 text 类型最大长度必须为 null，当前为 "${fieldMax}"`);
                                fileValid = false;
                                continue;
                            }
                        } else if (fieldType === 'string') {
                            // string：最大长度必为具体数字，且 1..65535
                            const isValidNumber = (value) => value !== 'null' && !isNaN(parseFloat(value)) && isFinite(parseFloat(value));
                            if (!isValidNumber(fieldMax)) {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 最大长度 "${fieldMax}" 格式错误，string 类型必须为具体数字`);
                                fileValid = false;
                                continue;
                            }
                            const maxVal = parseInt(fieldMax, 10);
                            if (!(maxVal > 0 && maxVal <= 65535)) {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 最大长度 ${fieldMax} 越界，string 类型长度必须在 1..65535 范围内`);
                                fileValid = false;
                                continue;
                            }
                        } else if (fieldType === 'array') {
                            // array：最大长度必为数字（用于JSON字符串长度限制）
                            const isValidNumber = (value) => value !== 'null' && !isNaN(parseFloat(value)) && isFinite(parseFloat(value));
                            if (!isValidNumber(fieldMax)) {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 最大长度 "${fieldMax}" 格式错误，array 类型必须为具体数字`);
                                fileValid = false;
                                continue;
                            }
                        } else {
                            // number 等其他：允许 null 或数字
                            const isValidMinMax = (value) => value === 'null' || (!isNaN(parseFloat(value)) && isFinite(parseFloat(value)));
                            if (!isValidMinMax(fieldMax)) {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 最大值 "${fieldMax}" 格式错误，必须为null或数字`);
                                fileValid = false;
                                continue;
                            }
                        }

                        // 第5个值：默认值校验
                        if (fieldType === 'text') {
                            // text 不允许默认值
                            if (fieldDefault !== 'null') {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 为 text 类型，默认值必须为 null，当前为 "${fieldDefault}"`);
                                fileValid = false;
                                continue;
                            }
                        } else {
                            const isValidDefault = (value) => {
                                if (value === 'null') return true;
                                if (!isNaN(parseFloat(value)) && isFinite(parseFloat(value))) return true;
                                return true; // 其他情况视为字符串，都是有效的
                            };
                            if (!isValidDefault(fieldDefault)) {
                                Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 默认值 "${fieldDefault}" 格式错误，必须为null、字符串或数字`);
                                fileValid = false;
                                continue;
                            }
                        }
                    } catch (error) {
                        Logger.error(`${fileType}表 ${fileName} 文件 ${colKey} 验证规则解析失败: ${error.message}`);
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
