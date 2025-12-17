import AutoImport from "unplugin-auto-import/vite";
import { TDesignResolver } from "unplugin-vue-components/resolvers";
import { VueRouterAutoImports } from "unplugin-vue-router";

/**
 * 创建自动导入插件配置
 */
export function createAutoImportPlugin(options = {}) {
    const { resolvers = {} } = options;

    return AutoImport({
        imports: ["vue", "pinia", VueRouterAutoImports],
        resolvers: [
            TDesignResolver({
                library: "vue-next"
            }),
            ...(resolvers.auto || [])
        ],
        dts: "src/types/auto-imports.d.ts",
        dirs: ["src/utils", "src/plugins", "src/config"],
        vueTemplate: true
    });
}
