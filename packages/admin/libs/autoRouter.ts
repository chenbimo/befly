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
 * 1. views/ 下的每个 .vue 文件自动生成路由
 * 2. 文件名转换为 kebab-case 路径
 * 3. 支持布局模板，通过文件名后缀 #数字 指定
 *
 * 文件命名规则：
 * - login.vue       → /login
 * - dashboard.vue   → /dashboard
 * - news.vue        → /news (使用默认布局 0.vue)
 * - news#1.vue      → /news (使用布局 1.vue)
 *
 * 布局规则：
 * - 默认使用 layouts/0.vue
 * - 文件名#数字.vue 使用对应的 layouts/数字.vue
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
const layoutFiles = import.meta.glob('${layoutsDir}/*.vue');

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
        // 移除 #数字 后缀
        .replace(/#\\d+$/, '')
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
        .replace(/#\\d+$/, '')
        .split('/')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
}

/**
 * 从文件路径提取布局编号
 * @param filePath - 文件路径
 * @returns 布局编号，默认为 0
 */
function getLayoutIndex(filePath: string): string {
    const match = filePath.match(/#(\\d+)\\.vue$/);
    return match ? match[1] : '0';
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
        .replace(/\\.vue$/, '')
        .replace(/#\\d+$/, '')
        .split('/')[0];
    return publicRoutes.includes(routeName);
}

// 生成路由配置
const routes: RouteRecordRaw[] = [];
const publicRoutes: RouteRecordRaw[] = [];
const layoutRoutes: { [layoutIndex: string]: RouteRecordRaw[] } = {};

// 排除的目录
const excludeDirs = ${JSON.stringify(exclude)};

for (const filePath in viewFiles) {
    // 跳过排除的目录
    if (excludeDirs.some(dir => filePath.includes('/' + dir + '/'))) {
        continue;
    }

    const routePath = filePathToRoutePath(filePath);
    const routeName = filePathToRouteName(filePath);
    const layoutIndex = getLayoutIndex(filePath);
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
        // 需要布局的路由，按布局分组
        if (!layoutRoutes[layoutIndex]) {
            layoutRoutes[layoutIndex] = [];
        }
        layoutRoutes[layoutIndex].push(route);
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
    ...publicRoutes
];

// 为每个布局创建父路由
for (const layoutIndex in layoutRoutes) {
    const layoutPath = '${layoutsDir}/' + layoutIndex + '.vue';
    const layoutComponent = layoutFiles[layoutPath];

    if (layoutComponent) {
        finalRoutes.push({
            path: '/',
            name: 'Layout' + layoutIndex,
            component: layoutComponent,
            children: layoutRoutes[layoutIndex]
        });
    }
}

export default finalRoutes;
`;
            }
        }
    };
}
