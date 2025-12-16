/**
 * 根据 views 目录结构生成 menus.json 菜单文件
 *
 * 规则：
 * - 扫描 views 目录下的所有子目录
 * - 目录名带 `_数字` 后缀的表示使用特殊布局，不生成菜单（如 login_1, 403_1）
 * - 每个目录的 meta.json 包含菜单名称和排序
 * - 子目录自动成为子菜单
 */

import { existsSync, writeFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'pathe';

interface MenuMeta {
    name: string;
    order?: number;
    icon?: string;
}

interface MenuItem {
    name: string;
    path: string;
    icon: string;
    sort: number;
    pid: number;
    children?: MenuItem[];
}

/**
 * 读取目录的 meta.json
 */
async function readMeta(dir: string): Promise<MenuMeta | null> {
    const metaPath = join(dir, 'meta.json');
    if (!existsSync(metaPath)) return null;

    try {
        const content = await readFile(metaPath, 'utf-8');
        return JSON.parse(content) as MenuMeta;
    } catch {
        return null;
    }
}

/**
 * 判断是否为特殊布局目录（如 login_1, 403_1）
 */
function isSpecialLayout(name: string): boolean {
    return /_\d+$/.test(name);
}

/**
 * 递归扫描目录生成菜单
 */
async function scanMenuDir(dir: string, parentPath: string = ''): Promise<MenuItem[]> {
    const items: MenuItem[] = [];

    const entries = await readdir(dir, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());

    for (const entry of dirs) {
        const name = entry.name;

        // 跳过特殊目录
        if (name === 'components' || name.startsWith('_')) continue;

        // 跳过特殊布局目录
        if (isSpecialLayout(name)) continue;

        const fullPath = join(dir, name);
        const meta = await readMeta(fullPath);

        // 没有 meta.json 的目录跳过
        if (!meta) continue;

        const routePath = parentPath ? `${parentPath}/${name}` : `/${name}`;

        const menuItem: MenuItem = {
            name: meta.name,
            path: routePath,
            icon: meta.icon || '',
            sort: meta.order || 0,
            pid: 0,
            children: []
        };

        // 递归扫描子目录
        const subEntries = await readdir(fullPath, { withFileTypes: true });
        const subDirs = subEntries.filter((e) => e.isDirectory() && e.name !== 'components' && !e.name.startsWith('_'));

        if (subDirs.length > 0) {
            menuItem.children = await scanMenuDir(fullPath, routePath);
        }

        // 如果没有子菜单，删除 children 属性
        if (menuItem.children && menuItem.children.length === 0) {
            delete menuItem.children;
        }

        items.push(menuItem);
    }

    // 按 sort 排序
    items.sort((a, b) => a.sort - b.sort);

    return items;
}

/**
 * 将树形菜单转换为扁平结构（带 pid）
 */
function flattenMenus(menus: MenuItem[], pid: number = 0): Omit<MenuItem, 'children'>[] {
    const result: Omit<MenuItem, 'children'>[] = [];
    let currentId = pid === 0 ? 1 : pid * 100;

    for (const menu of menus) {
        const id = currentId++;
        const { children, ...menuWithoutChildren } = menu;
        const flatMenu = {
            ...menuWithoutChildren,
            pid: pid
        };
        result.push(flatMenu);

        if (children && children.length > 0) {
            result.push(...flattenMenus(children, id));
        }
    }

    return result;
}

/**
 * 主函数：生成 menus.json
 */
async function genMenus() {
    const cwd = process.cwd();
    const viewsDir = join(cwd, 'views');

    if (!existsSync(viewsDir)) {
        process.stderr.write('错误：当前目录下没有 views 目录\n');
        process.exit(1);
    }

    process.stdout.write(`扫描目录: ${viewsDir}\n`);

    const menus = await scanMenuDir(viewsDir);

    // 输出树形结构（用于预览）
    process.stdout.write('\n菜单结构:\n');
    process.stdout.write(JSON.stringify(menus, null, 2) + '\n');

    // 扁平化输出
    const flatMenus = flattenMenus(menus);

    // 写入文件
    const outputPath = join(cwd, 'menus.json');
    writeFileSync(outputPath, JSON.stringify(flatMenus, null, 4), 'utf-8');

    process.stdout.write(`\n已生成: ${outputPath}\n`);
    process.stdout.write(`菜单数量: ${flatMenus.length}\n`);
}

// 执行
genMenus().catch((err) => {
    const msg = err instanceof Error ? err.stack || err.message : String(err);
    process.stderr.write(`生成失败: ${msg}\n`);
    process.exit(1);
});
