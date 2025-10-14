// 模板文件：自动路由生成结果基模板
// 说明：
//   目录固定：src/views ；布局目录固定：src/layouts
//   仅识别 views/<name>/<name>.vue 结构；index 为根路径
//   固定排除子目录：components
//   不区分公开/私有路由，全部挂到对应布局（目录后缀 _n 指定布局 n，默认 0）

// 在虚拟模块环境中，统一使用绝对形式 '/src/...'
// 支持多级目录：新规则
//   1. 任意目录下的 index.vue 代表该目录的“默认路由”，不再附加文件段：/news/index.vue -> /news
//   2. 非 index.vue 页面，路径 = 所有目录段 + 文件名：/news/detail/detail.vue -> /news/detail/detail
//      即使文件名与末级目录同名亦需保留（区别于旧规则会省略重复）
//   3. 根目录 index.vue -> '/'
//   4. 末级目录可带布局后缀 _n，布局编号取自该后缀；路径使用去掉后缀的目录名；中间层暂不支持布局后缀
//   5. 任何层级的 components 子目录下文件忽略
//   6. 大小写驼峰与下划线会被 kebab 化
// 示例：
//   /src/views/news/index.vue              => /news
//   /src/views/news/detail/detail.vue      => /news/detail/detail
//   /src/views/user/profile/index.vue      => /user/profile
//   /src/views/user/profile/edit.vue       => /user/profile/edit
//   /src/views/index.vue                   => /
//   /src/views/dashboard_2/index.vue       => /dashboard  (布局2)
//   /src/views/dashboard_2/analysis.vue    => /dashboard/analysis  (布局2)
const viewFiles = import.meta.glob('/src/views/**/*.vue');
const layoutFiles = import.meta.glob('/src/layouts/*.vue');

const layoutRoutes = {};

function normalizePath(p) {
    return p.replace(/\\/g, '/');
}
function getLayoutIndex(dir) {
    const m = dir.match(/_(\d+)$/);
    return m ? m[1] : '0';
}
function stripLayoutSuffix(dir) {
    return dir.replace(/_\d+$/, '');
}
function toKebab(s) {
    return s
        .replace(/([a-z])([A-Z])/g, '$1-$2') // camelCase -> camel-Case
        .replace(/[\s_]+/g, '-') // 空白或下划线 -> -
        .toLowerCase()
        .replace(/-+/g, '-') // 合并多余 -
        .replace(/^|-$/g, ''); // 去首尾 -
}
function buildPath(name) {
    return name === 'index' ? '/' : '/' + toKebab(name);
}
function buildName(name) {
    return toKebab(name);
}
// 不再区分公开路由，全部放入对应布局

for (const fp in viewFiles) {
    const normPath = normalizePath(fp);
    if (!normPath.endsWith('.vue')) continue;
    if (normPath.includes('/components/')) continue;
    const rootMarker = '/src/views/';
    const idx = normPath.indexOf(rootMarker);
    if (idx === -1) continue;
    const rel = normPath.slice(idx + rootMarker.length); // 相对 views 的路径
    const parts = rel.split('/');
    const fileName = parts.pop(); // <name>.vue 或 index.vue
    if (!fileName) continue;
    const fileBase = fileName.replace(/\.vue$/, '');
    const dirChainOriginal = parts; // 目录数组（可能为空）
    if (dirChainOriginal.some((d) => d === 'components')) continue;
    // 布局取末级目录（若存在）
    const lastDirOriginal = dirChainOriginal[dirChainOriginal.length - 1] || '';
    const layout = lastDirOriginal ? getLayoutIndex(lastDirOriginal) : '0';
    const dirChainForPath = dirChainOriginal.map((d, i) => (i === dirChainOriginal.length - 1 ? stripLayoutSuffix(d) : d));
    // index.vue 作为目录默认：不追加文件名；非 index 保留
    const pathSegments = [...dirChainForPath];
    if (fileBase !== 'index') pathSegments.push(fileBase);
    // root index 情况：views/index.vue => []
    if (pathSegments.length === 1 && pathSegments[0] === 'index') pathSegments.pop();
    // kebab 化
    const kebabSegments = pathSegments.map(toKebab).filter(Boolean);
    const routePath = '/' + kebabSegments.join('/');
    const routeName = kebabSegments.length ? kebabSegments.join('-') : 'index';
    const route = { path: routePath === '/' ? '/' : routePath, name: routeName, component: viewFiles[fp], meta: { title: routeName, file: fp } };
    if (!layoutRoutes[layout]) layoutRoutes[layout] = [];
    if (!layoutRoutes[layout].some((r) => r.path === route.path)) layoutRoutes[layout].push(route);
}
const finalRoutes = [];
for (const k in layoutRoutes) {
    const lp = '/src/layouts/' + k + '.vue';
    const comp = layoutFiles[lp];
    if (comp) {
        finalRoutes.push({ path: '/', name: 'layout' + k, component: comp, children: layoutRoutes[k] });
    }
}
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
