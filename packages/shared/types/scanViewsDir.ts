/**
 * scanViewsDir 相关纯函数的类型定义（类型模块，仅供 type 引用）。
 */

export type ViewDirMeta = {
    title: string;
    order?: number;
};

export type MenuNodeLike<T> = {
    name?: string;
    path?: string;
    sort?: number;
    children?: T[];
};

export type CleanDirName = (name: string) => string;

export type NormalizeMenuPath = (path: string) => string;

export type NormalizeMenuTree = <T extends MenuNodeLike<T>>(menus: T[]) => T[];

export type ExtractScriptSetupBlock = (vueContent: string) => string | null;

export type ExtractDefinePageMetaFromScriptSetup = (scriptSetup: string) => ViewDirMeta | null;
