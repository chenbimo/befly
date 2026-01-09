import type { Dirent } from "node:fs";

import { statSync } from "node:fs";

import { join } from "pathe";

export type DirentLike = Pick<Dirent, "name" | "isDirectory" | "isSymbolicLink">;

export const isDirentDirectory = (parentDir: string, entry: DirentLike): boolean => {
    if (entry.isDirectory()) {
        return true;
    }

    // 兼容 Windows 下的 junction / workspace link：Dirent.isDirectory() 可能为 false，但它实际指向目录。
    if (!entry.isSymbolicLink()) {
        return false;
    }

    try {
        const stats = statSync(join(parentDir, entry.name));
        return stats.isDirectory();
    } catch {
        return false;
    }
};
