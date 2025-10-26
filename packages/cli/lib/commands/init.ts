/**
 * Init 命令 - 初始化 Befly 项目
 */

import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import degit from 'degit';
import inquirer from 'inquirer';
import { Logger } from '../utils/logger.js';
import { Spinner } from '../utils/spinner.js';

interface InitOptions {
    template: string;
    skipInstall: boolean;
    force: boolean;
}

export async function initCommand(projectName?: string, options: InitOptions = { template: 'full', skipInstall: false, force: false }) {
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
        if (!template || template === 'full') {
            const answer = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'template',
                    message: '选择项目模板:',
                    choices: [
                        { name: 'Full - 完整项目 (包含前端和后端)', value: 'full' },
                        { name: 'API - 仅后端 API', value: 'api' }
                    ],
                    default: 'full'
                }
            ]);
            template = answer.template;
        }

        Logger.info(`\n创建项目: ${projectName}`);
        Logger.info(`项目模板: ${template}\n`);

        // 4. 下载模板
        const spinner = Spinner.start('正在下载模板...');

        try {
            const emitter = degit('chenbimo/befly/packages/tpl', {
                cache: false,
                force: true,
                verbose: false
            });

            await emitter.clone(targetDir);
            spinner.succeed('模板下载完成');
        } catch (error) {
            spinner.fail('模板下载失败');
            throw error;
        }

        // 5. 更新 package.json
        const packageJsonPath = join(targetDir, 'package.json');
        if (existsSync(packageJsonPath)) {
            const spinner2 = Spinner.start('更新项目配置...');
            try {
                const packageJson = JSON.parse(await Bun.file(packageJsonPath).text());
                packageJson.name = projectName;
                packageJson.version = '0.1.0';
                packageJson.private = true;

                await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 4), 'utf-8');
                spinner2.succeed('项目配置更新完成');
            } catch (error) {
                spinner2.fail('项目配置更新失败');
                Logger.warn('请手动更新 package.json');
            }
        }

        // 6. 创建 .env 文件
        const envPath = join(targetDir, '.env');
        if (!existsSync(envPath)) {
            const envDevPath = join(targetDir, '.env.development');
            if (existsSync(envDevPath)) {
                const spinner3 = Spinner.start('创建环境变量文件...');
                try {
                    const envContent = await Bun.file(envDevPath).text();
                    await writeFile(envPath, envContent, 'utf-8');
                    spinner3.succeed('环境变量文件创建完成');
                } catch (error) {
                    spinner3.warn('请手动复制 .env.development 为 .env');
                }
            }
        }

        // 7. 安装依赖
        if (!options.skipInstall) {
            const spinner4 = Spinner.start('正在安装依赖...');
            try {
                const proc = Bun.spawn(['bun', 'install'], {
                    cwd: targetDir,
                    stdout: 'pipe',
                    stderr: 'pipe'
                });

                await proc.exited;

                if (proc.exitCode === 0) {
                    spinner4.succeed('依赖安装完成');
                } else {
                    spinner4.fail('依赖安装失败');
                    Logger.warn('请手动执行: cd ' + projectName + ' && bun install');
                }
            } catch (error) {
                spinner4.fail('依赖安装失败');
                Logger.warn('请手动执行: cd ' + projectName + ' && bun install');
            }
        }

        // 8. 初始化 Git
        const spinner5 = Spinner.start('初始化 Git 仓库...');
        try {
            const proc = Bun.spawn(['git', 'init'], {
                cwd: targetDir,
                stdout: 'pipe',
                stderr: 'pipe'
            });

            await proc.exited;

            if (proc.exitCode === 0) {
                spinner5.succeed('Git 仓库初始化完成');
            } else {
                spinner5.warn('Git 仓库初始化失败');
            }
        } catch (error) {
            spinner5.warn('Git 仓库初始化失败');
        }

        // 9. 显示下一步提示
        Logger.success(`\n✨ 项目创建成功！\n`);
        Logger.info('下一步:');
        Logger.info(`  cd ${projectName}`);
        if (options.skipInstall) {
            Logger.info(`  bun install`);
        }
        Logger.info(`  bun run dev\n`);
        Logger.info('访问: http://localhost:3000\n');
    } catch (error) {
        Logger.error('项目创建失败:');
        console.error(error);
        process.exit(1);
    }
}
