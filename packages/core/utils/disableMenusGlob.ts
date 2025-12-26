import { Glob } from "bun";

export type DisableMenuGlobRule = {
    type: "glob";
    raw: string;
    glob: Glob;
};

const compiledGlobCache = new Map<string, Glob>();

function normalizeDisableMenusRules(disableMenus: unknown): string[] {
    if (typeof disableMenus === "undefined") {
        return [];
    }

    if (!Array.isArray(disableMenus)) {
        throw new Error("disableMenus 配置不合法：必须是 string[]");
    }

    const normalized: string[] = [];

    for (const rawRule of disableMenus) {
        if (typeof rawRule !== "string") {
            throw new Error("disableMenus 配置不合法：数组元素必须是 string");
        }

        const rule = rawRule.trim();
        if (!rule) {
            throw new Error("disableMenus 配置不合法：不允许空字符串");
        }

        normalized.push(rule);
    }

    return normalized;
}

function getOrCreateGlob(pattern: string): Glob {
    const existed = compiledGlobCache.get(pattern);
    if (existed) {
        return existed;
    }

    const created = new Glob(pattern);
    compiledGlobCache.set(pattern, created);
    return created;
}

/**
 * 将 disableMenus 编译为 Bun.Glob 规则（带进程级缓存）。
 * - 仅使用 Bun.Glob 的语法与 API。
 * - 此函数也会做基础的 disableMenus 配置校验（数组/string/非空）。
 */
export function compileDisableMenuGlobRules(disableMenus: unknown): DisableMenuGlobRule[] {
    const normalized = normalizeDisableMenusRules(disableMenus);
    if (normalized.length === 0) {
        return [];
    }

    const rules: DisableMenuGlobRule[] = [];

    for (const rule of normalized) {
        try {
            const glob = getOrCreateGlob(rule);
            rules.push({
                type: "glob",
                raw: rule,
                glob: glob
            });
        } catch (error: any) {
            throw new Error(`disableMenus 配置不合法：glob 规则 ${rule} 解析失败：${error?.message || String(error)}`);
        }
    }

    return rules;
}

export function isMenuPathDisabledByGlobRules(path: string, rules: DisableMenuGlobRule[]): boolean {
    for (const rule of rules) {
        if (rule.glob.match(path)) {
            return true;
        }
    }
    return false;
}
