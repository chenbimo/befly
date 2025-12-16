import IconsResolver from "unplugin-icons/resolver";
import { TDesignResolver } from "unplugin-vue-components/resolvers";
import Components from "unplugin-vue-components/vite";

/**
 * 创建组件自动导入插件配置
 */
export function createComponentsPlugin(options = {}) {
  const { resolvers = {} } = options;

  return Components({
    resolvers: [
      TDesignResolver({
        library: "vue-next",
      }),
      IconsResolver({}),
      ...(resolvers.components || []),
    ],
    dirs: ["src/components"],
    deep: true,
    dts: "src/types/components.d.ts",
  });
}
