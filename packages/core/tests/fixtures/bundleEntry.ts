import { scanSources } from "../../utils/scanSources";

export async function run(): Promise<{
    hooksCount: number;
    pluginsCount: number;
    apisCount: number;
    hasCoreAuthHook: boolean;
    hasCoreDbPlugin: boolean;
    hasCoreApi: boolean;
}> {
    const result = await scanSources();

    const hooksCount = Array.isArray(result.hooks) ? result.hooks.length : 0;
    const pluginsCount = Array.isArray(result.plugins) ? result.plugins.length : 0;
    const apisCount = Array.isArray(result.apis) ? result.apis.length : 0;

    const hasCoreAuthHook = Array.isArray(result.hooks) ? result.hooks.some((item: any) => item && item.source === "core" && item.moduleName === "auth") : false;
    const hasCoreDbPlugin = Array.isArray(result.plugins) ? result.plugins.some((item: any) => item && item.source === "core" && item.moduleName === "db") : false;
    const hasCoreApi = Array.isArray(result.apis) ? result.apis.some((item: any) => item && item.source === "core") : false;

    return {
        hooksCount: hooksCount,
        pluginsCount: pluginsCount,
        apisCount: apisCount,
        hasCoreAuthHook: hasCoreAuthHook,
        hasCoreDbPlugin: hasCoreDbPlugin,
        hasCoreApi: hasCoreApi
    };
}
