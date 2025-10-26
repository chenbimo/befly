/**
 * Init 命令 - 初始化 Befly 项目
 */

import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import * as tar from 'tar';
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
            // 4.1 获取包信息
            const registry = 'https://registry.npmmirror.com';
            const packageName = template; // 直接使用模板名称作为包名
            const version = 'latest';

            const metaResponse = await fetch(`${registry}/${packageName}/${version}`);
            if (!metaResponse.ok) {
                throw new Error(`获取包信息失败: ${metaResponse.statusText}`);
            }

            const metadata = await metaResponse.json();
            const tarballUrl = metadata.dist.tarball;

            // 4.2 下载 tarball
            spinner.text = '正在下载模板文件...';
            const tarballResponse = await fetch(tarballUrl);
            if (!tarballResponse.ok) {
                throw new Error(`下载失败: ${tarballResponse.statusText}`);
            }

            const arrayBuffer = await tarballResponse.arrayBuffer();
            const tempDir = join(process.cwd(), '.temp');
            const tempFile = join(tempDir, 'befly-temp.tgz');

            // 4.3 创建临时目录和目标目录
            if (!existsSync(tempDir)) {
                await mkdir(tempDir, { recursive: true });
            }
            if (!existsSync(targetDir)) {
                await mkdir(targetDir, { recursive: true });
            }

            // 4.4 保存临时文件
            await Bun.write(tempFile, arrayBuffer);

            // 4.5 解压 tarball (tar 库自动处理 gzip)
            spinner.text = '正在解压模板...';
            await tar.extract({
                file: tempFile,
                cwd: targetDir,
                strip: 1 // 去掉顶层 package/ 目录
            });

            // 4.6 清理临时文件
            await unlink(tempFile);

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
