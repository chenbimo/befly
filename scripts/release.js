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
  bun run release:major            发布大版本
  bun run release:minor            发布次要版本
  bun run release:patch            发布补丁版本
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
 * 执行命令
 */
function executeCommand(command, description) {
    try {
        console.log(`正在执行: ${description}`);
        console.log(`命令: ${command}`);

        const result = execSync(command, {
            encoding: 'utf8',
            stdio: 'inherit',
            cwd: join(__dirname, '..')
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
            cwd: join(__dirname, '..')
        });

        if (status.trim()) {
            console.warn('警告: 工作目录有未提交的更改');
            console.log('未提交的文件:');
            console.log(status);
            console.log('\n请先提交更改或使用 git stash 保存更改后再发布');
            return false;
        }
        return true;
    } catch (error) {
        console.warn('警告: 无法检查 Git 状态:', error.message);
        return true;
    }
}

/**
 * 主函数
 */
function main() {
    // 解析参数（如果是帮助命令会直接退出）
    const versionType = parseArguments();

    console.log('🚀 开始发布流程...\n');
    console.log(`版本类型: ${versionType}`);

    // 检查 Git 状态
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
    try {
        executeCommand('git add package.json', '添加 package.json 到 Git');
        executeCommand(`git commit -m "chore: bump version to ${newVersion}"`, '提交版本更新');
        executeCommand(`git tag v${newVersion}`, '创建版本标签');
    } catch (error) {
        console.warn('Git 操作失败，继续发布到 npm...');
    }

    // 发布到 npm
    executeCommand('bun publish --registry=https://registry.npmjs.org --access=public', '发布到 npm');

    // 推送到远程仓库
    try {
        executeCommand('git push', '推送代码到远程仓库');
        executeCommand('git push --tags', '推送标签到远程仓库');
    } catch (error) {
        console.warn('推送到远程仓库失败:', error.message);
    }

    console.log(`\n🎉 版本 ${newVersion} 发布成功！`);
    console.log(`📦 包名: ${packageData.name}`);
    console.log(`🔗 npm: https://www.npmjs.com/package/${packageData.name}`);
}

// 启动主函数
main();
