#!/usr/bin/env bun

import { join } from 'path';
import { $ } from 'bun';

// 以“执行发布命令的目录”为目标目录（兼容 core 与 tpl）
const runDir = process.cwd();
// 获取 package.json 路径（必须存在，否则判定为无效包目录）
const packagePath = join(runDir, 'package.json');
// 统一设置命令工作目录
$.cwd = runDir;

// 省略独立的参数解析函数，直接在 main 中处理

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

// 不进行任何 Git 操作

// 直接在 main 中进行 package.json 读写

// 省略独立的必要文件检查函数，直接在 main 中判断

/**
 * 主函数
 */
async function main() {
    // 解析参数（仅支持 --major | --minor | --patch）
    const args = process.argv.slice(2);
    let versionType;
    if (args.includes('--major')) versionType = 'major';
    else if (args.includes('--minor')) versionType = 'minor';
    else if (args.includes('--patch')) versionType = 'patch';
    else {
        console.error('错误: 缺少版本类型参数 (--major | --minor | --patch)');
        process.exit(1);
    }

    console.log('🚀 开始发布流程...\n');
    console.log(`版本类型: ${versionType}`);

    // 检查必要文件（仅 package.json）
    console.log('\n--- 检查必要文件 ---');
    if (!(await Bun.file(packagePath).exists())) {
        console.error('错误: 当前目录不是有效的 npm 包目录（缺少 package.json）');
        console.log('\n发布已取消');
        process.exit(1);
    }

    // 读取当前版本（直接读取文件）
    let packageData;
    try {
        const content = await Bun.file(packagePath).text();
        packageData = JSON.parse(content);
    } catch (error) {
        console.error('错误: 无法读取 package.json:', error?.message || error);
        process.exit(1);
    }
    const currentVersion = packageData.version;
    console.log(`当前版本: ${currentVersion}`);

    // 计算新版本
    const newVersion = updateVersion(currentVersion, versionType);
    console.log(`新版本: ${newVersion}\n`);

    // 更新版本号并写回（直接写入文件）
    packageData.version = newVersion;
    try {
        const content = JSON.stringify(packageData, null, 4);
        await Bun.write(packagePath, content);
    } catch (error) {
        console.error('错误: 无法写入 package.json:', error?.message || error);
        process.exit(1);
    }

    // 发布到 npm
    console.log('\n--- NPM 发布 ---');
    try {
        await $`bun publish --registry=https://registry.npmjs.org --access=public`;
        console.log('✓ 发布到 npm 完成');
    } catch (error) {
        console.error('错误: 发布到 npm 失败：', error?.message || error);
        process.exit(1);
    }

    console.log(`\n🎉 版本 ${newVersion} 发布成功！`);
    console.log(`📦 包名: ${packageData.name}`);
    console.log(`🔗 npm: https://www.npmjs.com/package/${packageData.name}`);
}

// 启动主函数
main().catch((e) => {
    console.error('发布流程发生未捕获错误：', e?.message || e);
    process.exit(1);
});
