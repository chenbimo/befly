// 模板文件：自动路由生成结果基模板
// 说明：
//   目录固定：src/views ；布局目录固定：src/layouts（支持 internal 子目录）
//   仅识别 views/<name>/<name>.vue 结构；index 为根路径
//   固定排除子目录：components
//   不区分公开/私有路由，全部挂到对应布局（文件名后缀 *_n.vue 指定布局 n，默认 0）
//   布局查找优先级：src/layouts/{n}.vue > src/layouts/internal/{n}.vue
//   （用户自定义布局可以覆盖 internal 内置布局）

// 在虚拟模块环境中，统一使用绝对形式 '/src/...'
// 支持多级目录：新规则
//   1. 任意目录下的 index.vue 代表该目录的"默认路由"，不再附加文件段：/news/index.vue -> /news
//   2. 非 index.vue 页面，路径 = 所有目录段 + 文件名：/news/detail/detail.vue -> /news/detail/detail
//      即使文件名与末级目录同名亦需保留（区别于旧规则会省略重复）
//   3. 根目录 index.vue -> '/'
//   4. 布局后缀规则：
//      - 目录名支持 `_n` 后缀，该目录下所有文件继承该布局
//      - 文件名支持 `_n` 后缀，文件布局优先于目录布局
//      - 多级目录时，最内层布局目录优先
//      - 路径生成时会自动去除目录和文件名的布局后缀
//   5. 任何层级的 components 子目录下文件忽略
//   6. 大小写驼峰与下划线会被 kebab 化
// 示例：
//   /src/views/news/index.vue                => /news (布局0)
//   /src/views/news/detail/detail.vue        => /news/detail/detail (布局0)
//   /src/views/index.vue                     => / (布局0)
//   /src/views/dashboard_2/index.vue         => /dashboard (布局2，继承目录)
//   /src/views/dashboard_2/analysis.vue      => /dashboard/analysis (布局2，继承目录)
//   /src/views/dashboard_2/profile_3.vue     => /dashboard/profile (布局3，文件优先)
//   /src/views/admin_1/user_2/index.vue      => /admin/user (布局2，最内层目录)
//   /src/views/admin_1/user_2/settings_3.vue => /admin/user/settings (布局3，文件优先)
const viewFiles = import.meta.glob('/src/views/**/*.vue');
// 同时扫描自定义布局和 internal 布局
const layoutFiles = import.meta.glob('/src/layouts/*.vue');
const internalLayoutFiles = import.meta.glob('/src/layouts/internal/*.vue');

/**
 * 路径规范化：统一为正斜杠
 */
function normalizePath(p) {
    return p.replace(/\\/g, '/');
}

/**
 * 从文件名或目录名提取布局信息
 * @param {string} name - 文件名或目录名（不含扩展名）
 * @returns {{ name: string, layout: string }} - 去除后缀的名称和布局编号
 */
function extractLayoutFromName(name) {
    const match = name.match(/_(\d+)$/);
    if (match) {
        return {
            name: name.replace(/_\d+$/, ''),
            layout: match[1]
        };
    }
    return { name, layout: '0' };
}

/**
 * 转换为 kebab-case
 * @param {string} str - 需要转换的字符串
 * @returns {string} - kebab-case 字符串
 */
function toKebab(str) {
    return str
        .replace(/([a-z])([A-Z])/g, '$1-$2') // camelCase -> camel-Case
        .replace(/[\s_]+/g, '-') // 空白或下划线 -> -
        .toLowerCase()
        .replace(/-+/g, '-') // 合并多余 -
        .replace(/^-|-$/g, ''); // 去首尾 -
}

/**
 * 处理目录链，提取布局和生成路径用的目录链
 * @param {string[]} dirChain - 原始目录数组
 * @returns {{ layout: string, pathDirs: string[] }} - 目录布局和去除后缀的目录链
 */
function processDirectoryChain(dirChain) {
    let dirLayout = '0';
    const pathDirs = [];

    // 遍历目录链，后面的布局会覆盖前面的（最内层优先）
    for (const dir of dirChain) {
        const { name: cleanDirName, layout: currentLayout } = extractLayoutFromName(dir);

        if (currentLayout !== '0') {
            dirLayout = currentLayout; // 更新布局编号
        }

        pathDirs.push(cleanDirName); // 路径使用去除后缀的目录名
    }

    return { layout: dirLayout, pathDirs };
}

/**
 * 构建路由路径和名称
 * @param {string[]} pathDirs - 目录链（已去除布局后缀）
 * @param {string} fileName - 文件名（已去除布局后缀）
 * @returns {{ path: string, name: string }} - 路由路径和名称
 */
function buildRoute(pathDirs, fileName) {
    const pathSegments = [...pathDirs];

    // index 文件不追加文件名到路径
    if (fileName !== 'index') {
        pathSegments.push(fileName);
    }

    // 特殊处理：internal/index 作为根路径
    if (pathSegments.length === 2 && pathSegments[0] === 'internal' && pathSegments[1] === 'index') {
        pathSegments.length = 0; // 清空数组，使其成为根路径
    }
    // 根目录 index 特殊处理：views/index.vue => []
    else if (pathSegments.length === 1 && pathSegments[0] === 'index') {
        pathSegments.pop();
    }

    // kebab 化所有路径段
    const kebabSegments = pathSegments.map(toKebab).filter(Boolean);

    const routePath = kebabSegments.length > 0 ? '/' + kebabSegments.join('/') : '/';
    const routeName = kebabSegments.length > 0 ? kebabSegments.join('-') : 'index';

    return { path: routePath, name: routeName };
}

/**
 * 检查路径是否应该被排除
 * @param {string} normalizedPath - 规范化后的文件路径
 * @param {string[]} dirChain - 目录链
 * @returns {boolean} - 是否排除
 */
function shouldExclude(normalizedPath, dirChain) {
    // 路径中包含 /components/
    if (normalizedPath.includes('/components/')) {
        return true;
    }

    // 目录链中包含 components
    if (dirChain.some((dir) => dir === 'components')) {
        return true;
    }

    return false;
}

/**
 * 处理单个视图文件
 * @param {string} filePath - 文件路径
 * @param {Function} componentLoader - 组件加载函数
 * @returns {Object|null} - 路由配置对象或 null
 */
function processViewFile(filePath, componentLoader) {
    const normPath = normalizePath(filePath);

    // 只处理 .vue 文件
    if (!normPath.endsWith('.vue')) {
        return null;
    }

    // 提取相对于 views 的路径
    const rootMarker = '/src/views/';
    const idx = normPath.indexOf(rootMarker);
    if (idx === -1) {
        return null;
    }

    const relativePath = normPath.slice(idx + rootMarker.length);
    const parts = relativePath.split('/');
    const fileName = parts.pop();

    if (!fileName) {
        return null;
    }

    // 获取目录链和文件名（去除 .vue）
    const dirChain = parts;
    const rawFileName = fileName.replace(/\.vue$/, '');

    // 检查是否应该排除
    if (shouldExclude(normPath, dirChain)) {
        return null;
    }

    // 处理目录链，获取目录布局和清理后的目录名
    const { layout: dirLayout, pathDirs } = processDirectoryChain(dirChain);

    // 处理文件名，提取文件布局
    const { name: cleanFileName, layout: fileLayout } = extractLayoutFromName(rawFileName);

    // 确定最终布局：文件布局优先，否则使用目录布局
    const finalLayout = fileLayout !== '0' ? fileLayout : dirLayout;

    // 构建路由路径和名称
    const { path, name } = buildRoute(pathDirs, cleanFileName);

    return {
        path,
        name,
        layout: finalLayout,
        component: componentLoader,
        meta: { title: name, file: filePath }
    };
}

/**
 * 生成最终的路由配置
 */
function generateRoutes() {
    const layoutRoutes = {};

    // 处理所有视图文件
    for (const filePath in viewFiles) {
        const route = processViewFile(filePath, viewFiles[filePath]);

        if (!route) {
            continue;
        }

        // 按布局分组
        if (!layoutRoutes[route.layout]) {
            layoutRoutes[route.layout] = [];
        }

        // 避免重复路径
        const exists = layoutRoutes[route.layout].some((r) => r.path === route.path);
        if (!exists) {
            layoutRoutes[route.layout].push({
                path: route.path,
                name: route.name,
                component: route.component,
                meta: route.meta
            });
        }
    }

    // 构建最终路由数组
    const finalRoutes = [];
    for (const layoutNum in layoutRoutes) {
        // 优先查找用户自定义布局，如果不存在则使用 internal 布局
        const customLayoutPath = '/src/layouts/' + layoutNum + '.vue';
        const internalLayoutPath = '/src/layouts/internal/' + layoutNum + '.vue';

        let layoutComponent = layoutFiles[customLayoutPath];

        // 如果自定义布局不存在，尝试使用 internal 布局
        if (!layoutComponent) {
            layoutComponent = internalLayoutFiles[internalLayoutPath];
        }

        if (layoutComponent) {
            finalRoutes.push({
                path: '/',
                name: 'layout' + layoutNum,
                component: layoutComponent,
                children: layoutRoutes[layoutNum]
            });
        }
    }

    return finalRoutes;
}

// 生成路由
const finalRoutes = generateRoutes();
// 开发环境下在浏览器控制台打印一次路由结果
if (typeof window !== 'undefined' && import.meta && import.meta.env && import.meta.env.DEV) {
    // 使用 setTimeout 避免与其他插件初始化竞争
    setTimeout(() => {
        // eslint-disable-next-line no-console
        console.log(
            '[auto-routes] 当前生成路由:',
            finalRoutes.map((r) => ({ layout: r.name, children: r.children?.map((c) => ({ path: c.path, name: c.name, file: c.meta?.file })) }))
        );
    }, 0);
}

export default finalRoutes;
