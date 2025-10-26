/**
 * Init 命令 - 初始化 Befly 项目
 */

import { join } from 'node:path';
import { existsSync } from 'node:fs';
import pacote from 'pacote';
import inquirer from 'inquirer';
import { Logger } from '../utils/logger.js';
import { Spinner } from '../utils/spinner.js';

interface InitOptions {
    template: string;
    force: boolean;
}

export async function initCommand(projectName?: string, options: InitOptions = { template: 'befly-tpl', force: false }) {
    try {
        // 1. 获取项目名称
        if (!projectName) {
            const answer = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'name',
                    message: '项目名称:',
                    default: 'my-befly-app',
                    validate: (input: string) => {
                        if (!input.trim()) {
                            return '项目名称不能为空';
                        }
                        if (!/^[a-z0-9-_]+$/.test(input)) {
                            return '项目名称只能包含小写字母、数字、横线和下划线';
                        }
                        return true;
                    }
                }
            ]);
            projectName = answer.name;
        }

        // 2. 检查目录是否存在
        const targetDir = join(process.cwd(), projectName);
        if (existsSync(targetDir) && !options.force) {
            const answer = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'overwrite',
                    message: `目录 ${projectName} 已存在，是否覆盖？`,
                    default: false
                }
            ]);

            if (!answer.overwrite) {
                Logger.info('已取消');
                return;
            }
        }

        // 3. 选择模板
        let template = options.template;
        if (!template || !['befly-tpl', 'befly-admin'].includes(template)) {
            const answer = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'template',
                    message: '选择项目模板:',
                    choices: [
                        { name: 'befly-tpl - Befly 接口模板', value: 'befly-tpl' },
                        { name: 'befly-admin - Befly 后台模板', value: 'befly-admin' }
                    ],
                    default: 'befly-tpl'
                }
            ]);
            template = answer.template;
        }

        Logger.info(`\n创建项目: ${projectName}`);
        Logger.info(`项目模板: ${template}\n`);

        // 4. 下载模板
        const spinner = Spinner.start('正在下载模板...');

        try {
            const registry = 'https://registry.npmmirror.com';
            const packageSpec = `${template}@latest`;

            // 使用 pacote 下载并解压到目标目录
            await pacote.extract(packageSpec, targetDir, {
                registry,
                cache: join(process.cwd(), '.temp', 'pacote-cache')
            });

            spinner.succeed('模板下载完成');

            Logger.success(`\n✨ 项目创建成功！\n`);
        } catch (error) {
            spinner.fail('模板下载失败');
            Logger.error('请检查网络连接或包是否存在');
            console.error(error);
            throw error;
        }
    } catch (error) {
        Logger.error('项目创建失败:');
        console.error(error);
        process.exit(1);
    }
}
