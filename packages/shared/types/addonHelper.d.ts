/**
 * 扫描所有可用的 addon
 * 优先从本地 addons/ 目录加载，其次从 node_modules/@befly-addon/ 加载
 * @param cwd - 项目根目录，默认为 process.cwd()
 * @returns addon 名称数组
 */
export declare const scanAddons: (cwd?: string) => string[];
/**
 * 获取 addon 的指定子目录路径
 * 优先返回本地 addons 目录，其次返回 node_modules 目录
 * @param name - addon 名称
 * @param subDir - 子目录名称
 * @param cwd - 项目根目录，默认为 process.cwd()
 * @returns 完整路径
 */
export declare const getAddonDir: (name: string, subDir: string, cwd?: string) => string;
/**
 * 检查 addon 子目录是否存在
 * @param name - addon 名称
 * @param subDir - 子目录名称
 * @param cwd - 项目根目录，默认为 process.cwd()
 * @returns 是否存在
 */
export declare const addonDirExists: (name: string, subDir: string, cwd?: string) => boolean;
