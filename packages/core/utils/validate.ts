/**
 * 数据验证器 - 框架适配版本
 * 从 lib/validator 导入并配置 RegexAliases 和 parseRule
 */

import { RegexAliases } from '../config/regexAliases.js';
import { parseRule } from './table.js';
import { Validator as LibValidator } from '../lib/validator.js';
import type { TableDefinition } from '../types/common.js';
import type { ValidationResult } from '../types/validator';

/**
 * 验证器类（使用 RegexAliases 和 parseRule 配置）
 */
export class Validator extends LibValidator {
    constructor() {
        super({
            regexAliases: RegexAliases as any,
            parseRule
        });
    }
}

/**
 * 导出验证器实例（使用 RegexAliases 和 parseRule）
 */
export const validator = new Validator();

/**
 * 导出静态方法（带默认配置）
 */
export const validate = (dataOrValue: any, rulesOrRule: any, required: string[] = []): any => {
    const config = { regexAliases: RegexAliases as any, parseRule };
    if (typeof rulesOrRule === 'string') {
        return LibValidator.validate(dataOrValue, rulesOrRule, config);
    }
    return LibValidator.validate(dataOrValue, rulesOrRule, required, config);
};

// 导出类型和配置
export type { ValidatorConfig, DEFAULT_REGEX_ALIASES } from '../lib/validator.js';
