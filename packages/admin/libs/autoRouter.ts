import type { Plugin } from 'vite';

interface RouterPluginOptions {
    viewsDir?: string;
    layoutsDir?: string;
    exclude?: string[];
}

/**
 * Befly Admin 自动文件路由插件
 *
 * 基于 views 目录结构自动生成路由配置
 *
 * 规则：
 * 1. views/ 下的每个目录/文件自动生成路由
 * 2. index.vue 映射为父路径
 * 3. 文件名转换为 kebab-case 路径
 * 4. 支持嵌套路由
 * 5. 支持布局模板
 *
 * 文件命名规则：
 * - login/index.vue       → /login
 * - dashboard/index.vue   → /dashboard
 * - user/list.vue         → /user/list
 * - user/detail.vue       → /user/detail
 * - setting/index.vue     → /setting
 *
 * 布局规则：
 * - _public.vue           → 公开布局（不需要登录）
 * - 其他页面默认使用      → layouts/default.vue
 */
export function autoRouterPlugin(options: RouterPluginOptions = {}): Plugin {
    const { viewsDir = '@/views', layoutsDir = '@/layouts', exclude = ['components'] } = options;

    const virtualModuleId = 'virtual:auto-routes';
    const resolvedVirtualModuleId = '\0' + virtualModuleId;

    return {
        name: 'befly-auto-router',
        enforce: 'pre',

        resolveId(id) {
            if (id === virtualModuleId) {
                return resolvedVirtualModuleId;
            }
        },

        load(id) {
            if (id === resolvedVirtualModuleId) {
                return `
import type { RouteRecordRaw } from 'vue-router';

// 自动导入所有 views 目录下的 .vue 文件
const viewFiles = import.meta.glob('${viewsDir}/**/*.vue');

// 导入布局文件
const defaultLayout = () => import('${layoutsDir}/default.vue');

/**
 * 将文件路径转换为路由路径
 * @param filePath - 文件路径
 * @returns 路由路径
 */
function filePathToRoutePath(filePath: string): string {
    return filePath
        // 统一路径分隔符
        .replace(/[\\\\\\/]+/g, '/')
        // 移除 views 目录前缀
        .replace(/.*\\/views\\//, '')
        // 移除 .vue 后缀
        .replace(/\\.vue$/, '')
        // 将 index 转换为空
        .replace(/\\/index$/, '')
        // 驼峰转 kebab-case
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .toLowerCase()
        // 清理多余的分隔符
        .replace(/[\\s_]+/g, '-')
        // 确保以 / 开头
        .replace(/^\\/?/, '/');
}

/**
 * 从文件路径提取路由名称
 * @param filePath - 文件路径
 * @returns 路由名称
 */
function filePathToRouteName(filePath: string): string {
    return filePath
        .replace(/[\\\\\\/]+/g, '/')
        .replace(/.*\\/views\\//, '')
        .replace(/\\.vue$/, '')
        .replace(/\\/index$/, '')
        .split('/')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
}

/**
 * 判断是否为公开路由（不需要登录）
 * @param filePath - 文件路径
 * @returns 是否为公开路由
 */
function isPublicRoute(filePath: string): boolean {
    const publicRoutes = ['login', 'register', 'forgot-password', '404', '403', '500'];
    const routeName = filePath
        .replace(/[\\\\\\/]+/g, '/')
        .replace(/.*\\/views\\//, '')
        .replace(/\\/index\\.vue$/, '')
        .replace(/\\.vue$/, '')
        .split('/')[0];
    return publicRoutes.includes(routeName);
}

// 生成路由配置
const routes: RouteRecordRaw[] = [];
const publicRoutes: RouteRecordRaw[] = [];
const layoutRoutes: RouteRecordRaw[] = [];

// 排除的目录
const excludeDirs = ${JSON.stringify(exclude)};

for (const filePath in viewFiles) {
    // 跳过排除的目录
    if (excludeDirs.some(dir => filePath.includes('/' + dir + '/'))) {
        continue;
    }

    const routePath = filePathToRoutePath(filePath);
    const routeName = filePathToRouteName(filePath);
    const isPublic = isPublicRoute(filePath);

    const route: RouteRecordRaw = {
        path: routePath || '/',
        name: routeName,
        component: viewFiles[filePath],
        meta: {
            title: routeName,
            public: isPublic
        }
    };

    if (isPublic) {
        // 公开路由（不需要布局）
        publicRoutes.push(route);
    } else {
        // 需要布局的路由
        layoutRoutes.push({
            path: routePath || '/',
            name: routeName,
            component: viewFiles[filePath],
            meta: {
                title: routeName,
                public: false
            }
        });
    }
}

// 组合最终路由
const finalRoutes: RouteRecordRaw[] = [
    // 根路径重定向
    {
        path: '/',
        redirect: '/dashboard'
    },
    // 公开路由
    ...publicRoutes,
    // 带布局的路由
    {
        path: '/',
        name: 'Layout',
        component: defaultLayout,
        children: layoutRoutes
    }
];

export default finalRoutes;
`;
            }
        }
    };
}
