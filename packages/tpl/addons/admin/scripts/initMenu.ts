import { SqlHelper } from 'befly';
import { createSqlClient } from 'befly';
import { RedisHelper } from 'befly';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 初始化菜单数据
 * 说明：根据 menu.json 配置文件同步生成菜单数据库数据
 *
 * 流程：
 * 1. 读取 menu.json 配置文件
 * 2. 递归处理菜单树，先插入父级菜单获得 ID
 * 3. 再插入子级菜单，使用父级 ID
 * 4. 最终数据库中包含完整的菜单层级关系
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建数据库和Redis客户端
const SQL = await createSqlClient();
const redis = RedisHelper;
// 创建一个假的 befly 上下文用于 SqlHelper
const mockBefly: any = { sql: SQL, redis };
const db = new SqlHelper(mockBefly, SQL);

/**
 * 递归插入菜单
 * @param menus 菜单数组
 * @param parentId 父菜单 ID（0 表示顶级菜单）
 * @returns 插入的菜单 ID 数组
 */
async function insertMenus(menus: any[], parentId: number = 0): Promise<number[]> {
    const insertedIds: number[] = [];

    for (const menu of menus) {
        // 插入当前菜单
        const menuId = await db.insData({
            table: 'addon_admin_menu',
            data: {
                pid: parentId,
                name: menu.name,
                path: menu.path || '',
                icon: menu.icon || '',
                sort: menu.sort || 0,
                type: menu.type || 1,
                status: menu.status ?? 1
            }
        });

        insertedIds.push(menuId);
        console.log(`  ${parentId === 0 ? '└' : '  └'} 插入菜单: ${menu.name} (ID: ${menuId}, PID: ${parentId})`);

        // 如果有子菜单，递归插入
        if (menu.children && menu.children.length > 0) {
            const childIds = await insertMenus(menu.children, menuId);
            insertedIds.push(...childIds);
        }
    }

    return insertedIds;
}

try {
    console.log('开始同步菜单配置到数据库...\n');

    // 1. 软删除现有菜单（将 deleted_at 设置为当前时间戳）
    console.log('=== 步骤 1: 清理旧菜单 ===');
    await db.query('UPDATE admin_menu SET deleted_at = ? WHERE deleted_at = 0', [Date.now()]);
    console.log('✅ 已软删除所有旧菜单\n');

    // 2. 读取菜单配置文件
    console.log('=== 步骤 2: 读取配置文件 ===');
    const configPath = path.resolve(__dirname, '../config/menu.json');
    const menuConfig = await Bun.file(configPath).json();
    console.log(`✅ 配置文件读取成功: ${configPath}\n`);

    // 3. 递归插入菜单
    console.log('=== 步骤 3: 插入菜单 ===');
    const insertedIds = await insertMenus(menuConfig, 0);

    // 4. 构建树形结构预览
    console.log('\n=== 步骤 4: 菜单结构预览 ===');
    const allMenus = await db.query('SELECT id, pid, name, path, type FROM admin_admin_menu WHERE deleted_at = 0 ORDER BY pid, sort, id');

    // 递归构建树
    function buildTree(parentId: number = 0, level: number = 0): string[] {
        const lines: string[] = [];
        const children = allMenus.filter((m: any) => m.pid === parentId);

        children.forEach((menu: any, index: number) => {
            const isLast = index === children.length - 1;
            const prefix = '  '.repeat(level) + (isLast ? '└─' : '├─');
            const typeLabel = menu.type === 0 ? '[目录]' : '[菜单]';
            lines.push(`${prefix} ${typeLabel} ${menu.name} (${menu.path})`);

            // 递归子菜单
            const subLines = buildTree(menu.id, level + 1);
            lines.push(...subLines);
        });

        return lines;
    }

    const treeLines = buildTree();
    console.log(treeLines.join('\n'));

    // 5. 输出统计信息
    console.log('\n=== 菜单同步完成 ===');
    console.log(`✅ 共插入 ${insertedIds.length} 个菜单`);
    console.log(`📋 顶级菜单: ${allMenus.filter((m: any) => m.pid === 0).length} 个`);
    console.log(`📋 子菜单: ${allMenus.filter((m: any) => m.pid !== 0).length} 个`);
    console.log('\n后续步骤：');
    console.log('运行 bun run addons/admin/scripts/initDev.ts 初始化开发者账号和权限');

    await SQL.end();
    process.exit(0);
} catch (error) {
    console.error('❌ 菜单同步失败:', error);
    await SQL.end();
    process.exit(1);
}
