export type ViewDirMeta = {
    title: string;
    order?: number;
};

type MenuNodeLike<T> = {
    name?: string;
    path?: string;
    sort?: number;
    children?: T[];
};

/**
 * 清理目录名中的数字后缀
 * 如：login_1 → login, index_2 → index
 */
export function cleanDirName(name: string): string {
    return name.replace(/_\d+$/, "");
}

/**
 * 约束：统一 path 形态，避免隐藏菜单匹配、DB 同步出现重复
 * - 必须以 / 开头
 * - 折叠多个 /
 * - 去掉尾随 /（根 / 除外）
 */
export function normalizeMenuPath(path: string): string {
    let result = path;

    if (!result) {
        return "/";
    }

    if (!result.startsWith("/")) {
        result = `/${result}`;
    }

    result = result.replace(/\/+/g, "/");

    if (result.length > 1) {
        result = result.replace(/\/+$/, "");
    }

    return result;
}

/**
 * 递归规范化并按 path 去重（同 path 的 children 合并）
 *
 * 说明：该函数是纯函数，不依赖任何运行时环境；会返回新数组，但会在内部对克隆对象做合并赋值。
 */
export function normalizeMenuTree<T extends MenuNodeLike<T>>(menus: T[]): T[] {
    const map = new Map<string, T>();

    for (const menu of menus) {
        const rawPath = menu.path;
        const menuPath = rawPath ? normalizeMenuPath(rawPath) : "";

        if (!menuPath) {
            continue;
        }

        // 不使用 structuredClone：
        // - 结构中可能出现函数/类实例等不可 clone 的值
        // - 这里我们只需要“保留额外字段 + 递归 children 生成新数组”
        // 用浅拷贝即可满足需求
        const cloned = Object.assign({}, menu) as T;
        (cloned as any).path = menuPath;

        const rawChildren = menu.children;
        if (rawChildren && rawChildren.length > 0) {
            (cloned as any).children = normalizeMenuTree(rawChildren);
        }

        const existing = map.get(menuPath);
        if (existing) {
            const clonedChildren = (cloned as any).children as T[] | undefined;
            if (clonedChildren && clonedChildren.length > 0) {
                let existingChildren = (existing as any).children as T[] | undefined;
                if (!existingChildren) {
                    existingChildren = [];
                    (existing as any).children = existingChildren;
                }

                for (const child of clonedChildren) {
                    existingChildren.push(child);
                }

                (existing as any).children = normalizeMenuTree(existingChildren);
            }

            if (typeof cloned.sort === "number") {
                (existing as any).sort = cloned.sort;
            }

            if (typeof cloned.name === "string" && cloned.name) {
                (existing as any).name = cloned.name;
            }
        } else {
            map.set(menuPath, cloned);
        }
    }

    const result = Array.from(map.values());
    result.sort((a, b) => ((a as any).sort ?? 999) - ((b as any).sort ?? 999));
    return result;
}

/**
 * 只取第一个 <script ... setup ...> 块
 */
export function extractScriptSetupBlock(vueContent: string): string | null {
    const openTag = /<script\b[^>]*\bsetup\b[^>]*>/i.exec(vueContent);
    if (!openTag) {
        return null;
    }

    const start = openTag.index + openTag[0].length;
    const closeIndex = vueContent.indexOf("</script>", start);
    if (closeIndex < 0) {
        return null;
    }

    return vueContent.slice(start, closeIndex);
}

/**
 * 从 <script setup> 中提取 definePage({ meta })
 *
 * 简化约束：
 * - 每个页面只有一个 definePage
 * - title 是纯字符串字面量
 * - order 是数字字面量（可选）
 * - 不考虑变量/表达式/多段 meta 组合
 */
export function extractDefinePageMetaFromScriptSetup(scriptSetup: string): ViewDirMeta | null {
    const titleMatch = scriptSetup.match(/definePage\s*\([\s\S]*?meta\s*:\s*\{[\s\S]*?title\s*:\s*(["'`])([^"'`]+)\1/);
    if (!titleMatch) {
        return null;
    }

    const orderMatch = scriptSetup.match(/definePage\s*\([\s\S]*?meta\s*:\s*\{[\s\S]*?order\s*:\s*(\d+)/);

    return {
        title: titleMatch[2],
        order: orderMatch ? Number(orderMatch[1]) : undefined
    };
}
