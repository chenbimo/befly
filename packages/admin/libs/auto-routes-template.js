// 模板文件：自动路由生成结果基模板
// 说明：
//   目录固定：src/views ；布局目录固定：src/layouts
//   仅识别 views/<name>/<name>.vue 结构；index 为根路径
//   固定排除子目录：components
//   不区分公开/私有路由，全部挂到对应布局（目录后缀 _n 指定布局 n，默认 0）

// 在虚拟模块环境中，统一使用绝对形式 '/src/...'
// 支持多级目录：示例
//   /src/views/user/profile/profile.vue        => /user/profile
//   /src/views/system/user/user.vue            => /system/user
//   /src/views/system/user/index/index.vue     => /system/user
//   /src/views/index/index.vue                 => /
//   /src/views/dashboard_2/dashboard.vue       => /dashboard  (布局 2)
// 规则：
//   1. 仅识别末级目录与同名文件（可带 _n 布局后缀）或 index/index 形式
//   2. 布局后缀 _n 仅作用在最后一级目录
//   3. 末级目录规范名为 'index' 时视为该层路径占位（不追加路径段）
//   4. 任意层目录名中的大写会被 kebab 化
//   5. 任意层若为 'components' 视为内部局部组件目录，直接忽略该文件
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
    if (normPath.includes('/components/')) continue;
    if (!normPath.endsWith('.vue')) continue;
    const idx = normPath.indexOf('/src/views/');
    if (idx === -1) continue;
    const rel = normPath.slice(idx + '/src/views/'.length); // e.g. system/user/user.vue
    const parts = rel.split('/');
    if (parts.length < 2) continue; // 至少 <dir>/<file>.vue
    const fileBase = parts[parts.length - 1].replace(/\.vue$/, '');
    const lastDir = parts[parts.length - 2];
    const lastDirBase = stripLayoutSuffix(lastDir);
    // 允许: <lastDir>/<lastDir>.vue | <lastDir>/<lastDirBase>.vue | index/index.vue
    if (!(fileBase === lastDir || fileBase === lastDirBase || (lastDirBase === 'index' && fileBase === 'index'))) continue;
    const layout = getLayoutIndex(lastDir);
    // 目录链（不含文件）
    const dirChain = parts.slice(0, parts.length - 1).map((seg, i, arr) => (i === arr.length - 1 ? stripLayoutSuffix(seg) : seg));
    // 若最后一级是 index 则移除
    if (dirChain[dirChain.length - 1] === 'index') dirChain.pop();
    // 生成路径与名称
    const kebabSegments = dirChain.map(toKebab).filter(Boolean);
    let routePath = '/' + kebabSegments.join('/');
    if (routePath === '/') routePath = '/';
    const routeName = kebabSegments.length ? kebabSegments.join('-') : 'index';
    const route = { path: routePath, name: routeName, component: viewFiles[fp], meta: { title: routeName, file: fp } };
    if (!layoutRoutes[layout]) layoutRoutes[layout] = [];
    if (!layoutRoutes[layout].some((r) => r.name === route.name && r.path === route.path)) {
        layoutRoutes[layout].push(route);
    }
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
