#!/usr/bin/env bun

import { join } from 'path';
import { $ } from 'bun';

const pkgPath = join(process.cwd(), 'package.json');
$.cwd = process.cwd();

const VERSION_MAP = { '-x': 'major', '-y': 'minor', '-z': 'patch' };

function exitWithError(message, error = null) {
    console.error(`错误: ${message}`);
    if (error) console.error(error?.message || error);
    process.exit(1);
}

async function readPackage() {
    try {
        return await Bun.file(pkgPath).json();
    } catch (error) {
        exitWithError('无法读取或解析 package.json', error);
    }
}

async function writePackage(pkg) {
    try {
        await Bun.write(pkgPath, JSON.stringify(pkg, null, 4));
    } catch (error) {
        exitWithError('无法写入 package.json', error);
    }
}

function updateVersion(version, type) {
    const parts = version.split('.').map(Number);
    if (parts.length !== 3) exitWithError('版本号格式不正确，应为 x.y.z 格式');

    const [major, minor, patch] = parts;
    const updates = {
        major: [major + 1, 0, 0],
        minor: [major, minor + 1, 0],
        patch: [major, minor, patch + 1]
    };

    if (!updates[type]) exitWithError('未知的版本类型');
    return updates[type].join('.');
}

async function main() {
    const args = process.argv.slice(2);
    const flag = args.find((arg) => VERSION_MAP[arg]);
    const versionType = VERSION_MAP[flag];

    if (!versionType) exitWithError('缺少版本类型参数 (-x | -y | -z)');

    console.log('🚀 开始发布流程...\n');
    console.log(`版本类型: ${versionType}`);
    console.log('\n--- 读取配置 ---');

    const pkg = await readPackage();
    console.log(`当前版本: ${pkg.version}`);

    const newVersion = updateVersion(pkg.version, versionType);
    console.log(`新版本: ${newVersion}\n`);

    pkg.version = newVersion;
    await writePackage(pkg);

    console.log('\n--- NPM 发布 ---');
    try {
        await $`bun publish --registry=https://registry.npmjs.org --access=public`;
        console.log('✓ 发布到 npm 完成');
    } catch (error) {
        exitWithError('发布到 npm 失败', error);
    }

    console.log(`\n🎉 版本 ${newVersion} 发布成功！`);
    console.log(`📦 包名: ${pkg.name}`);
    console.log(`🔗 npm: https://www.npmjs.com/package/${pkg.name}`);
}

main().catch((e) => exitWithError('发布流程发生未捕获错误', e));
