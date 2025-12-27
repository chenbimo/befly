/**
 * arrayToTree 类型定义（类型模块，仅供 type 引用）。
 */

export type ArrayToTreeResult<T extends Record<string, any>> = {
    flat: Array<T>;
    tree: Array<T>;
    map: Map<string, T>;
};

export type ArrayToTree = <T extends Record<string, any>>(items: T[], id?: string, pid?: string, children?: string, sort?: string) => ArrayToTreeResult<T>;
