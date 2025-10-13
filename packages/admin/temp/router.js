export const yiteRouter = (options) => {
    let config = {};
    const virtualModuleId = `virtual:yite-router`;
    const resolvedVirtualModuleId = '\0' + virtualModuleId;

    return {
        name: 'yite-router',
        enforce: 'pre',
        options(options) {},
        buildStart(options) {},
        configResolved(resolvedConfig) {
            config = resolvedConfig;
        },
        resolveId(id) {
            if (id === virtualModuleId) {
                return resolvedVirtualModuleId;
            }
        },
        load(id) {
            if (id === resolvedVirtualModuleId) {
                return `
        const pageFiles = import.meta.glob('@/pages/**/*.vue');
        const layoutFiles = import.meta.glob('@/layouts/*.vue');

        const layouts = {};
        const routes = [];



        const getRouteData = (file) => {
            const path = file //
                .replace(/[\\\\\/]+/g, '/')
                .replace(/.*\\/pages\\//, '')
                .replace(/(\\!\\d)?\\.vue/, '')
                .replace(/#\\d+/g, '')
                .replace(/([a-z])([A-Z])/g, '$1-$2')
                .replace(/-$/g, '')
                .toLowerCase()
                .replace(/[\\s_-]+/g, '-');
            const index = file.indexOf('!');
            const layout = index !== -1 ? file.substring(index + 1, file.length - 4) : 1;

            return {
                path: path,
                layout: Number(layout)
            };
        };

        for (let file in pageFiles) {
            if (file.indexOf('components') !== -1) continue;

            const routeData = getRouteData(file);
            routes.push({
                path: routeData.path === 'index' ? '/' : '/' + routeData.path,
                component: layoutFiles['/src/layouts/' + routeData.layout + '.vue'],
                children: [
                    {
                        path: '',
                        component: pageFiles[file]
                    }
                ]
            });
        }


        export { routes };
    `;
            }
        }
    };
};
