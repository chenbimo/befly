/**
 * Commands 工具函数
 * 提供命令间可复用的通用功能
 */

import { join, parse, dirname } from 'pathe';
import { existsSync, readFileSync } from 'node:fs';
import { Env } from 'befly';

export const projectDir = process.cwd();

/**
 * CLI Logger 工具
 * 提供统一的日志输出功能
 */
export const Logger = {
    /**
     * 普通日志
     */
    log(...args: any[]) {
        console.log(...args);
    },

    /**
     * 信息日志（蓝色）
     */
    info(...args: any[]) {
        console.log('\x1b[34m%s\x1b[0m', ...args);
    },

    /**
     * 成功日志（绿色）
     */
    success(...args: any[]) {
        console.log('\x1b[32m%s\x1b[0m', ...args);
    },

    /**
     * 警告日志（黄色）
     */
    warn(...args: any[]) {
        console.warn('\x1b[33m%s\x1b[0m', ...args);
    },

    /**
     * 错误日志（红色）
     */
    error(...args: any[]) {
        console.error('\x1b[31m%s\x1b[0m', ...args);
    },

    /**
     * 调试日志（灰色）
     */
    debug(...args: any[]) {
        console.log('\x1b[90m%s\x1b[0m', ...args);
    },

    /**
     * 打印当前运行环境
     * 用于命令开始时提示用户当前环境
     */
    printEnv() {
        console.log('========================================');
        console.log('开始执行完整同步流程');
        console.log(`当前环境: ${Env.NODE_ENV || 'development'}`);
        console.log(`项目名称: ${Env.APP_NAME || '-'}`);
        console.log(`数据库地址: ${Env.DB_HOST || '-'}`);
        console.log(`数据库名称: ${Env.DB_NAME || '-'}`);
        console.log('========================================\n');
    }
};

/**
 * 读取 package.json 文件内容
 *
 * @param pkgPath package.json 文件路径
 * @returns package.json 的内容对象
 */
export function readPackageJson(pkgPath: string): Record<string, any> {
    try {
        const content = readFileSync(pkgPath, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        throw new Error(`读取 package.json 失败: ${error}`);
    }
}

/**
 * 获取指定目录的 package.json 版本号
 *
 * @param dir 目录路径
 * @returns 版本号字符串
 */
export function getPackageVersion(dir: string): string {
    try {
        const pkgPath = join(dir, 'package.json');
        const pkg = readPackageJson(pkgPath);
        return pkg.version || '0.0.0';
    } catch (error) {
        return '0.0.0';
    }
}

/**
 * 解析字段规则字符串
 * 格式："字段名|类型|最小值|最大值|默认值|必填|正则"
 * 注意：只分割前6个|，第7个|之后的所有内容（包括|）都属于正则表达式
 */
export const parseRule = (rule: string): ParsedFieldRule => {
    const parts: string[] = [];
    let currentPart = '';
    let pipeCount = 0;

    for (let i = 0; i < rule.length; i++) {
        if (rule[i] === '|' && pipeCount < 6) {
            parts.push(currentPart);
            currentPart = '';
            pipeCount++;
        } else {
            currentPart += rule[i];
        }
    }
    parts.push(currentPart);

    const [fieldName = '', fieldType = 'string', fieldMinStr = 'null', fieldMaxStr = 'null', fieldDefaultStr = 'null', fieldIndexStr = '0', fieldRegx = 'null'] = parts;

    const fieldIndex = Number(fieldIndexStr) as 0 | 1;
    const fieldMin = fieldMinStr !== 'null' ? Number(fieldMinStr) : null;
    const fieldMax = fieldMaxStr !== 'null' ? Number(fieldMaxStr) : null;

    let fieldDefault: any = fieldDefaultStr;
    if (fieldType === 'number' && fieldDefaultStr !== 'null') {
        fieldDefault = Number(fieldDefaultStr);
    }

    return {
        name: fieldName,
        type: fieldType as 'string' | 'number' | 'text' | 'array_string' | 'array_text',
        min: fieldMin,
        max: fieldMax,
        default: fieldDefault,
        index: fieldIndex,
        regex: fieldRegx !== 'null' ? fieldRegx : null
    };
};
