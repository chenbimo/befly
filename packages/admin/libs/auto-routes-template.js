// 模板文件：自动路由生成结果基模板
// 占位符：
//   __VIEWS_GLOB__        -> import.meta.glob 视图匹配
//   __LAYOUTS_GLOB__      -> import.meta.glob 布局匹配
//   __EXCLUDE_DIRS__      -> JSON 字符串数组
//   __LAYOUTS_DIR__       -> 布局目录（字符串）
// 逻辑说明：仅识别 views/<name>/<name>.vue 结构，index 为根路径；固定排除 components 子目录；无公开路由特殊处理。

const viewFiles = import.meta.glob('__VIEWS_GLOB__');
const layoutFiles = import.meta.glob('__LAYOUTS_GLOB__');
const EXCLUDE_DIRS = ["components"]; // 固定排除目录

const publicRoutes = [];
const layoutRoutes = {};

function isPageEntry(p){
  const norm = p.replace(/\\\\/g,'/');
  const m = norm.match(/\\/views\\/([^/]+)\\/([^/]+)\\.vue$/);
  if(!m) return false;
  const dir=m[1]; const file=m[2];
  return file===dir || file===dir.replace(/_\\d+$/, '');
}
function extractBaseName(p){return p.replace(/\\\\/g,'/').replace(/.*\\/views\\//,'').replace(/\\.vue$/,'').split('/')[0];}
function getLayoutIndex(base){const m=base.match(/_(\\d+)$/);return m?m[1]:'0';}
function normalizeName(base){return base.replace(/_\\d+$/, '');}
function toKebab(s){return s.replace(/([a-z])([A-Z])/g,'$1-$2').replace(/[\\s_]+/g,'-').toLowerCase();}
function buildPath(name){return name==='index' ? '/' : '/' + toKebab(name);}
function buildName(name){return toKebab(name);}
// 不再区分公开路由，全部放入对应布局

for (const fp in viewFiles){
  if (EXCLUDE_DIRS.some(d=>fp.includes('/'+d+'/'))) continue;
  if (!isPageEntry(fp)) continue;
  const base = extractBaseName(fp);
  const norm = normalizeName(base);
  const layout = getLayoutIndex(base);
  const route = { path: buildPath(norm), name: buildName(norm), component: viewFiles[fp], meta: { title: buildName(norm) } };
  if (!layoutRoutes[layout]) layoutRoutes[layout] = [];
  if (!layoutRoutes[layout].some(r=>r.name===route.name)) layoutRoutes[layout].push(route);
}
const finalRoutes = [...publicRoutes];
for (const k in layoutRoutes){
  const lp='__LAYOUTS_DIR__/'+k+'.vue';
  const comp = layoutFiles[lp];
  if (comp){ finalRoutes.push({ path:'/', name:'layout'+k, component:comp, children:layoutRoutes[k] }); }
}
export default finalRoutes;
