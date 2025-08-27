#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { __filename, __dirname } from '../system.js';

// 获取 package.json 路径
const packagePath = join(__dirname, 'package.json');

/**
 * 解析命令行参数
 */
function parseArguments() {
    const args = process.argv.slice(2);

    if (args.includes('-h') || args.includes('--help')) {
        console.log(`
发布脚本使用说明:
  bun run scripts/release.js -a    发布大版本 (major)
  bun run scripts/release.js -b    发布次要版本 (minor)
  bun run scripts/release.js -c    发布补丁版本 (patch)
  bun run scripts/release.js -h    显示帮助信息

或者使用快捷命令:
  bun run ra                       发布大版本
  bun run rb                       发布次要版本
  bun run rc                       发布补丁版本
        `);
        process.exit(0);
    }

    if (args.includes('-a')) return 'major';
    if (args.includes('-b')) return 'minor';
    if (args.includes('-c')) return 'patch';

    console.error('错误: 请指定版本类型参数');
    console.log('使用 -h 或 --help 查看帮助信息');
    process.exit(1);
}

/**
 * 读取 package.json
 */
function readPackageJson() {
    try {
        const content = readFileSync(packagePath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error('错误: 无法读取 package.json:', error.message);
        process.exit(1);
    }
}

/**
 * 写入 package.json
 */
function writePackageJson(packageData) {
    try {
        const content = JSON.stringify(packageData, null, 4);
        writeFileSync(packagePath, content, 'utf8');
        console.log('✓ package.json 已更新');
    } catch (error) {
        console.error('错误: 无法写入 package.json:', error.message);
        process.exit(1);
    }
}

/**
 * 更新版本号
 */
function updateVersion(currentVersion, type) {
    const versionParts = currentVersion.split('.').map(Number);

    if (versionParts.length !== 3) {
        console.error('错误: 版本号格式不正确，应为 x.y.z 格式');
        process.exit(1);
    }

    let [major, minor, patch] = versionParts;

    switch (type) {
        case 'major':
            major += 1;
            minor = 0;
            patch = 0;
            break;
        case 'minor':
            minor += 1;
            patch = 0;
            break;
        case 'patch':
            patch += 1;
            break;
        default:
            console.error('错误: 未知的版本类型');
            process.exit(1);
    }

    return `${major}.${minor}.${patch}`;
}

/**
 * 执行 Git 命令（必须成功）
 */
function executeGitCommand(command, description) {
    try {
        console.log(`正在执行: ${description}`);
        console.log(`命令: ${command}`);

        const result = execSync(command, {
            encoding: 'utf8',
            stdio: 'inherit',
            cwd: __dirname
        });

        console.log(`✓ ${description} 完成`);
        return result;
    } catch (error) {
        console.error(`错误: ${description} 失败:`, error.message);
        console.error('Git 操作失败，发布已取消！');
        process.exit(1);
    }
}

/**
 * 执行命令（必须成功）
 */
function executeCommand(command, description) {
    try {
        console.log(`正在执行: ${description}`);
        console.log(`命令: ${command}`);

        const result = execSync(command, {
            encoding: 'utf8',
            stdio: 'inherit',
            cwd: __dirname
        });

        console.log(`✓ ${description} 完成`);
        return result;
    } catch (error) {
        console.error(`错误: ${description} 失败:`, error.message);
        process.exit(1);
    }
}

/**
 * 检查 Git 状态
 */
function checkGitStatus() {
    try {
        const status = execSync('git status --porcelain', {
            encoding: 'utf8',
            cwd: __dirname
        });

        if (status.trim()) {
            console.error('错误: 工作目录有未提交的更改');
            console.log('未提交的文件:');
            console.log(status);
            console.log('\n请先提交所有更改后再发布！');
            return false;
        }
        return true;
    } catch (error) {
        console.error('错误: 无法检查 Git 状态:', error.message);
        console.error('请确保当前目录是一个有效的 Git 仓库！');
        return false;
    }
}

/**
 * 检查必要文件是否存在
 */
function checkRequiredFiles() {
    const requiredFiles = ['main.js', 'system.js', 'package.json', 'README.md', 'LICENSE'];

    const missingFiles = [];

    for (const file of requiredFiles) {
        try {
            const filePath = join(__dirname, file);
            readFileSync(filePath);
        } catch (error) {
            missingFiles.push(file);
        }
    }

    if (missingFiles.length > 0) {
        console.error('错误: 以下必要文件缺失:');
        missingFiles.forEach((file) => console.error(`  - ${file}`));
        return false;
    }

    console.log('✓ 所有必要文件检查通过');
    return true;
}

/**
 * 主函数
 */
function main() {
    // 解析参数（如果是帮助命令会直接退出）
    const versionType = parseArguments();

    console.log('🚀 开始发布流程...\n');
    console.log(`版本类型: ${versionType}`);

    // 检查必要文件
    console.log('\n--- 检查必要文件 ---');
    if (!checkRequiredFiles()) {
        console.log('\n发布已取消');
        process.exit(1);
    }

    // 检查 Git 状态
    console.log('\n--- 检查 Git 状态 ---');
    if (!checkGitStatus()) {
        console.log('\n发布已取消');
        process.exit(1);
    }

    // 读取当前版本
    const packageData = readPackageJson();
    const currentVersion = packageData.version;
    console.log(`当前版本: ${currentVersion}`);

    // 计算新版本
    const newVersion = updateVersion(currentVersion, versionType);
    console.log(`新版本: ${newVersion}\n`);

    // 更新版本号
    packageData.version = newVersion;
    writePackageJson(packageData);

    // 提交版本更新
    console.log('\n--- Git 操作 ---');
    executeGitCommand('git add package.json', '添加 package.json 到 Git');
    executeGitCommand(`git commit -m "chore: bump version to ${newVersion}"`, '提交版本更新');
    executeGitCommand(`git tag v${newVersion}`, '创建版本标签');

    // 发布到 npm
    console.log('\n--- NPM 发布 ---');
    executeCommand('bun publish --registry=https://registry.npmjs.org --access=public', '发布到 npm');

    // 推送到远程仓库
    console.log('\n--- 推送到远程仓库 ---');
    executeGitCommand('git push', '推送代码到远程仓库');
    executeGitCommand('git push --tags', '推送标签到远程仓库');

    console.log(`\n🎉 版本 ${newVersion} 发布成功！`);
    console.log(`📦 包名: ${packageData.name}`);
    console.log(`🔗 npm: https://www.npmjs.com/package/${packageData.name}`);
}

// 启动主函数
main();
