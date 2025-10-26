/**
 * Script 命令 - 执行 befly 脚本
 * 列出并执行 core/scripts、tpl/scripts 和 addons/<addon>/scripts 下的脚本
 */

import path from 'node:path';
import { existsSync } from 'node:fs';
import { Glob } from 'bun';
import inquirer from 'inquirer';
import { Logger } from '../utils/logger.js';
import { Spinner } from '../utils/spinner.js';

interface ScriptItem {
    name: string;
    source: string;
    displayName: string;
    duplicate: boolean;
    path: string;
}

interface ScriptOptions {
    dryRun: boolean;
}

/**
 * 安全地列出目录下的所有 .ts 脚本文件
 */
function safeList(dir: string): string[] {
    try {
        if (!existsSync(dir)) {
            return [];
        }

        const glob = new Glob('*.ts');
        const files = Array.from(
            glob.scanSync({
                cwd: dir,
                absolute: false,
                onlyFiles: true,
                dot: false
            })
        );

        return files
            .map((f) => {
                const basename = path.basename(f);
                return basename.replace(/\.ts$/, '');
            })
            .sort();
    } catch {
        return [];
    }
}

/**
 * 扫描 addons 目录下所有组件的 scripts
 */
function scanAddonScripts(addonsDir: string): Array<{ addonName: string; scriptName: string; scriptPath: string }> {
    const results: Array<{ addonName: string; scriptName: string; scriptPath: string }> = [];

    try {
        if (!existsSync(addonsDir)) {
            return results;
        }

        const addonGlob = new Glob('*/scripts/*.ts');
        const addonFiles = Array.from(
            addonGlob.scanSync({
                cwd: addonsDir,
                absolute: false,
                onlyFiles: true,
                dot: false
            })
        );

        for (const file of addonFiles) {
            const parts = file.split(path.sep);
            if (parts.length === 3 && parts[1] === 'scripts') {
                const addonName = parts[0];
                const scriptName = path.basename(parts[2]).replace(/\.ts$/, '');
                const scriptPath = path.resolve(addonsDir, file);

                results.push({
                    addonName,
                    scriptName,
                    scriptPath
                });
            }
        }
    } catch (error) {
        Logger.warn('扫描 addon 脚本失败:', error);
    }

    return results;
}

/**
 * 获取项目根目录
 */
function getProjectRoot(): string {
    let current = process.cwd();
    while (current !== path.parse(current).root) {
        if (existsSync(path.join(current, 'package.json'))) {
            return current;
        }
        current = path.dirname(current);
    }
    return process.cwd();
}

export async function scriptCommand(options: ScriptOptions = { dryRun: false }) {
    try {
        const projectRoot = getProjectRoot();

        // 查找 core 和 tpl 的 scripts 目录
        const coreScriptsDir = path.join(projectRoot, 'node_modules', 'befly', 'scripts');
        const tplScriptsDir = path.join(projectRoot, 'scripts');
        const addonsDir = path.join(projectRoot, 'addons');

        // 扫描脚本
        const coreScripts = safeList(coreScriptsDir);
        const tplScripts = safeList(tplScriptsDir);
        const addonScripts = scanAddonScripts(addonsDir);

        // 合并脚本列表
        const allScripts: ScriptItem[] = [];
        const scriptNames = new Set<string>();

        // 添加 core 脚本
        for (const name of coreScripts) {
            allScripts.push({
                name,
                source: 'core',
                displayName: name,
                duplicate: false,
                path: path.join(coreScriptsDir, `${name}.ts`)
            });
            scriptNames.add(name);
        }

        // 添加 tpl 脚本
        for (const name of tplScripts) {
            const duplicate = scriptNames.has(name);
            allScripts.push({
                name,
                source: 'tpl',
                displayName: name,
                duplicate,
                path: path.join(tplScriptsDir, `${name}.ts`)
            });
            if (!duplicate) {
                scriptNames.add(name);
            }
        }

        // 添加 addon 脚本
        for (const item of addonScripts) {
            const duplicate = scriptNames.has(item.scriptName);
            allScripts.push({
                name: item.scriptName,
                source: item.addonName,
                displayName: `${item.addonName}/${item.scriptName}`,
                duplicate,
                path: item.scriptPath
            });
        }

        if (allScripts.length === 0) {
            Logger.warn('未找到可用的脚本');
            return;
        }

        // 显示脚本列表
        Logger.info('\n可用脚本:\n');

        // 按来源分组显示
        const grouped = new Map<string, ScriptItem[]>();
        for (const script of allScripts) {
            if (!grouped.has(script.source)) {
                grouped.set(script.source, []);
            }
            grouped.get(script.source)!.push(script);
        }

        // 显示分组
        for (const [source, scripts] of grouped) {
            Logger.info(`[${source}]`);
            for (const script of scripts) {
                const mark = script.duplicate ? ' (重名)' : '';
                Logger.info(`  - ${script.displayName}${mark}`);
            }
            Logger.info('');
        }

        // 选择脚本
        const choices = allScripts.map((script) => {
            const mark = script.duplicate ? ' (重名)' : '';
            return {
                name: `${script.displayName}${mark} [${script.source}]`,
                value: script.path
            };
        });

        const answer = await inquirer.prompt([
            {
                type: 'list',
                name: 'script',
                message: '选择要执行的脚本:',
                choices,
                pageSize: 15
            }
        ]);

        const selectedScript = allScripts.find((s) => s.path === answer.script);

        if (!selectedScript) {
            Logger.error('未找到选中的脚本');
            return;
        }

        if (options.dryRun) {
            Logger.info('\n[预演模式]');
            Logger.info(`脚本名称: ${selectedScript.displayName}`);
            Logger.info(`来源: ${selectedScript.source}`);
            Logger.info(`路径: ${selectedScript.path}`);
            return;
        }

        // 执行脚本
        Logger.info(`\n执行脚本: ${selectedScript.displayName}\n`);

        const spinner = Spinner.start('正在执行...');

        try {
            const proc = Bun.spawn(['bun', 'run', selectedScript.path], {
                cwd: projectRoot,
                stdout: 'inherit',
                stderr: 'inherit',
                stdin: 'inherit'
            });

            await proc.exited;

            if (proc.exitCode === 0) {
                spinner.succeed('脚本执行完成');
            } else {
                spinner.fail('脚本执行失败');
                process.exit(proc.exitCode || 1);
            }
        } catch (error) {
            spinner.fail('脚本执行失败');
            throw error;
        }
    } catch (error) {
        Logger.error('执行脚本失败:');
        console.error(error);
        process.exit(1);
    }
}
