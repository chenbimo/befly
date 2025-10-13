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
 * 3. 支持布局模板，通过文件名后缀 _数字 指定
 *
 * 文件命名规则：
 * - login.vue       → /login
 * - dashboard.vue   → /dashboard
 * - news.vue        → /news (使用默认布局 0.vue)
 * - news_1.vue      → /news (使用布局 1.vue)
 *
 * 布局规则：
 * - 默认使用 layouts/0.vue
 * - 文件名_数字.vue 使用对应的 layouts/数字.vue
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
// 自动导入所有 views 目录下的 .vue 文件
const viewFiles = import.meta.glob('${viewsDir}/**/*.vue');

// 导入布局文件
const layoutFiles = import.meta.glob('${layoutsDir}/*.vue');

/**
 * 将文件路径转换为路由路径
 */
function filePathToRoutePath(filePath) {
    return filePath
        .replace(/[\\\\\\/]+/g, '/')
        .replace(/.*\\/views\\//, '')
        .replace(/\\.vue$/, '')
        .replace(/_\\d+$/, '')
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .toLowerCase()
        .replace(/[\\s_]+/g, '-')
        .replace(/^\\/?/, '/');
}

/**
 * 从文件路径提取路由名称
 */
function filePathToRouteName(filePath) {
    return filePath
        .replace(/[\\\\\\/]+/g, '/')
        .replace(/.*\\/views\\//, '')
        .replace(/\\.vue$/, '')
        .replace(/_\\d+$/, '')
        .split('/')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
}

/**
 * 从文件路径提取布局编号
 */
function getLayoutIndex(filePath) {
    const match = filePath.match(/_(\\d+)\\.vue$/);
    return match ? match[1] : '0';
}

/**
 * 判断是否为公开路由（不需要登录）
 */
function isPublicRoute(filePath) {
    const publicRoutes = ['login', 'register', 'forgot-password', '404', '403', '500'];
    const routeName = filePath
        .replace(/[\\\\\\/]+/g, '/')
        .replace(/.*\\/views\\//, '')
        .replace(/\\.vue$/, '')
        .replace(/_\\d+$/, '')
        .split('/')[0];
    return publicRoutes.includes(routeName);
}

// 生成路由配置
const publicRoutes = [];
const layoutRoutes = {};

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

    const route = {
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
const finalRoutes = [
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
