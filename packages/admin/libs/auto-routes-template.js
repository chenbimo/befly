// 模板文件：自动路由生成结果基模板
// 说明：
//   目录固定：src/views ；布局目录固定：src/layouts
//   仅识别 views/<name>/<name>.vue 结构；index 为根路径
//   固定排除子目录：components
//   不区分公开/私有路由，全部挂到对应布局（目录后缀 _n 指定布局 n，默认 0）

// Vite glob 需要以 ./ 或 / 开头，这里使用 ./ 相对项目根（与插件所在构建上下文一致）
const viewFiles = import.meta.glob('./src/views/**/*.vue');
const layoutFiles = import.meta.glob('./src/layouts/*.vue');

const layoutRoutes = {};

function normalizePath(p) {
    return p.replace(/\\/g, '/');
}

function isPageEntry(p) {
    const norm = normalizePath(p);
    // 期望末尾形如: /views/<dir>/<file>.vue
    const parts = norm.split('/');
    const vuePart = parts[parts.length - 1]; // <file>.vue
    const dirPart = parts[parts.length - 2]; // <dir>
    if (!vuePart || !dirPart) return false;
    if (!vuePart.endsWith('.vue')) return false;
    const fileName = vuePart.slice(0, -4); // 去掉 .vue
    // 允许 fileName === dir 或 fileName === 去掉 _数字 的 dir
    const baseDir = dirPart.replace(/_\d+$/, '');
    return fileName === dirPart || fileName === baseDir;
}

function extractBaseName(p) {
    const norm = normalizePath(p);
    const parts = norm.split('/');
    const dirPart = parts[parts.length - 2];
    return dirPart;
}
function getLayoutIndex(base) {
    const m = base.match(/_(\\d+)$/);
    return m ? m[1] : '0';
}
function normalizeName(base) {
    return base.replace(/_\\d+$/, '');
}
function toKebab(s) {
    return s
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\\s_]+/g, '-')
        .toLowerCase();
}
function buildPath(name) {
    return name === 'index' ? '/' : '/' + toKebab(name);
}
function buildName(name) {
    return toKebab(name);
}
// 不再区分公开路由，全部放入对应布局

for (const fp in viewFiles) {
    if (['components'].some((d) => fp.includes('/' + d + '/'))) continue;
    if (!isPageEntry(fp)) continue;
    const base = extractBaseName(fp); // 目录名（可能带 _n）
    const norm = normalizeName(base); // 去掉 _n 的规范名
    const layout = getLayoutIndex(base);
    const route = { path: buildPath(norm), name: buildName(norm), component: viewFiles[fp], meta: { title: buildName(norm) } };
    if (!layoutRoutes[layout]) layoutRoutes[layout] = [];
    if (!layoutRoutes[layout].some((r) => r.name === route.name)) layoutRoutes[layout].push(route);
}
const finalRoutes = [];
for (const k in layoutRoutes) {
    const lp = './src/layouts/' + k + '.vue';
    const comp = layoutFiles[lp];
    if (comp) {
        finalRoutes.push({ path: '/', name: 'layout' + k, component: comp, children: layoutRoutes[k] });
    }
}
export default finalRoutes;
