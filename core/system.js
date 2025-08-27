import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';

/**
 * Befly 框架系统路径定义
 * 提供统一的路径变量，供整个框架使用
 */

// 当前文件的路径信息
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Befly 框架根目录
const __dirroot = __dirname;

// 各个重要目录的路径
const __dirscript = join(__dirroot, 'scripts');
const __dirbin = join(__dirroot, 'bin');
const __dirutils = join(__dirroot, 'utils');
const __dirconfig = join(__dirroot, 'config');
const __dirtables = join(__dirroot, 'tables');
const __dirchecks = join(__dirroot, 'checks');
const __dirapis = join(__dirroot, 'apis');
const __dirplugins = join(__dirroot, 'plugins');
const __dirlibs = join(__dirroot, 'libs');
const __dirtests = join(__dirroot, 'tests');

// 获取项目根目录（befly 框架的使用方项目）
const getProjectRoot = () => {
    return process.cwd();
};

// 获取项目中的特定目录
const getProjectDir = (subdir = '') => {
    return subdir ? join(getProjectRoot(), subdir) : getProjectRoot();
};

// 创建路径解析器，基于 befly 根目录
const resolveBeflyPath = (...paths) => {
    return resolve(__dirroot, ...paths);
};

// 创建路径解析器，基于项目根目录
const resolveProjectPath = (...paths) => {
    return resolve(getProjectRoot(), ...paths);
};

// 获取相对于 befly 根目录的相对路径
const getRelativeBeflyPath = (targetPath) => {
    return relative(__dirroot, targetPath);
};

// 获取相对于项目根目录的相对路径
const getRelativeProjectPath = (targetPath) => {
    return relative(getProjectRoot(), targetPath);
};

// 导出所有路径变量和工具函数
export {
    // 基础路径变量
    __filename,
    __dirname,
    __dirroot,

    // Befly 框架目录
    __dirscript,
    __dirbin,
    __dirutils,
    __dirconfig,
    __dirtables,
    __dirchecks,
    __dirapis,
    __dirplugins,
    __dirlibs,
    __dirtests,

    // 项目路径工具函数
    getProjectRoot,
    getProjectDir,

    // 路径解析工具函数
    resolveBeflyPath,
    resolveProjectPath,
    getRelativeBeflyPath,
    getRelativeProjectPath
};

// 默认导出包含所有路径信息的对象
export default {
    // 基础路径变量
    __filename,
    __dirname,
    __dirroot,

    // Befly 框架目录
    paths: {
        script: __dirscript,
        bin: __dirbin,
        utils: __dirutils,
        config: __dirconfig,
        tables: __dirtables,
        checks: __dirchecks,
        apis: __dirapis,
        plugins: __dirplugins,
        libs: __dirlibs,
        tests: __dirtests
    },

    // 工具函数
    utils: {
        getProjectRoot,
        getProjectDir,
        resolveBeflyPath,
        resolveProjectPath,
        getRelativeBeflyPath,
        getRelativeProjectPath
    }
};
