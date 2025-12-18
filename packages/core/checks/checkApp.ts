import { existsSync, mkdirSync, writeFileSync } from "node:fs";
// 内部依赖
import { join } from "node:path";

// 相对导入
import { Logger } from "../lib/logger.js";
import { projectApiDir, projectDir } from "../paths.js";

/**
 * 检查项目结构
 */
export async function checkApp(): Promise<void> {
    try {
        // 检查项目 apis 目录下是否存在名为 addon 的目录
        if (existsSync(projectApiDir)) {
            const addonDir = join(projectApiDir, "addon");
            if (existsSync(addonDir)) {
                throw new Error("项目 apis 目录下不能存在名为 addon 的目录，addon 是保留名称，用于组件接口路由");
            }
        }

        // 检查并创建 logs 目录
        const logsDir = join(projectDir, "logs");
        if (!existsSync(logsDir)) {
            mkdirSync(logsDir, { recursive: true });
        }

        // 检查并创建 configs 目录和配置文件
        const configsDir = join(projectDir, "configs");
        if (!existsSync(configsDir)) {
            mkdirSync(configsDir, { recursive: true });
        }

        // 检查并创建 befly.common.json
        const beflyJsonPath = join(configsDir, "befly.common.json");
        if (!existsSync(beflyJsonPath)) {
            writeFileSync(beflyJsonPath, "{}", "utf-8");
        }

        // 检查并创建 befly.development.json
        const beflyDevelopmentJsonPath = join(configsDir, "befly.development.json");
        if (!existsSync(beflyDevelopmentJsonPath)) {
            writeFileSync(beflyDevelopmentJsonPath, "{}", "utf-8");
        }

        // 检查并创建 befly.production.json
        const beflyProductionJsonPath = join(configsDir, "befly.production.json");
        if (!existsSync(beflyProductionJsonPath)) {
            writeFileSync(beflyProductionJsonPath, "{}", "utf-8");
        }
    } catch (error: any) {
        Logger.error("项目结构检查过程中出错", error);
        throw error;
    }
}
