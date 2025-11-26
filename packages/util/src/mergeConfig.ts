import { existsSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

import { mergeAndConcat } from 'merge-anything';
import { isPlainObject } from 'es-toolkit';

import type { LoadConfigOptions } from './configTypes.js';

/**
 * 加载并合并配置文件（矩阵搜索：dirs × files）
 * @param options - 加载选项
 * @returns 合并后的配置对象
 */
export async function mergeConfig(options: LoadConfigOptions): Promise<Record<string, any>> {
    const { dirs, files, required = false, extensions = ['.js', '.ts', '.json'] } = options;

    // 参数验证
    if (!Array.isArray(dirs) || dirs.length === 0) {
        throw new Error('dirs 必须是非空数组');
    }
    if (!Array.isArray(files) || files.length === 0) {
        throw new Error('files 必须是非空数组');
    }

    const configs: Record<string, any>[] = [];

    // 矩阵搜索：dirs × files × extensions
    for (const dir of dirs) {
        if (!isAbsolute(dir)) {
            throw new Error(`目录必须是绝对路径: ${dir}`);
        }

        for (const file of files) {
            for (const ext of extensions) {
                const fileName = file.endsWith(ext) ? file : file + ext;
                const filePath = join(dir, fileName);

                if (existsSync(filePath)) {
                    try {
                        // 动态导入配置文件（使用 import 断言处理 JSON）
                        let data: any;

                        if (ext === '.json') {
                            // JSON 文件使用 import 断言
                            const module = await import(filePath, { with: { type: 'json' } });
                            data = module.default;
                        } else {
                            // JS/TS 文件使用动态导入
                            const module = await import(filePath);
                            data = module.default || module;
                        }

                        // 验证配置数据
                        if (!isPlainObject(data)) {
                            console.warn(`配置文件不是对象，已跳过: ${filePath}`);
                            continue;
                        }

                        configs.push(data);

                        // 找到后跳过同名文件的其他扩展名
                        break;
                    } catch (error: any) {
                        console.error(`加载配置文件失败: ${filePath}`, error.message);
                    }
                }
            }
        }
    }

    // 检查必填要求
    if (required && configs.length === 0) {
        throw new Error(`未找到任何配置文件\ndirs: ${dirs.join(', ')}\nfiles: ${files.join(', ')}`);
    }

    // 合并配置（使用 mergeAndConcat 深度合并）
    return configs.length > 0 ? mergeAndConcat({}, ...configs) : {};
}
