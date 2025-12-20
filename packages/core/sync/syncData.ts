import { Connect } from "../lib/connect.js";
import { Logger } from "../lib/logger.js";
import { createSyncDataContext } from "./syncData/createSyncDataContext.js";
import { syncApi } from "./syncData/syncApi.js";
import { syncDev } from "./syncData/syncDev.js";
import { syncMenu } from "./syncData/syncMenu.js";

export async function syncDataCommand(): Promise<void> {
    try {
        await Connect.connect();

        const ctx = createSyncDataContext();

        // 顺序严格固定：接口 → 菜单 → dev
        await syncApi(ctx);
        await syncMenu(ctx);
        await syncDev(ctx);
    } catch (error: any) {
        Logger.error({ err: error }, "SyncData 执行失败");
        throw error;
    } finally {
        await Connect.disconnect();
    }
}
