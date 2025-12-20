import type { SyncDataContext } from "./types.js";

import { CacheHelper } from "../../lib/cacheHelper.js";
import { Connect } from "../../lib/connect.js";
import { DbHelper } from "../../lib/dbHelper.js";
import { RedisHelper } from "../../lib/redisHelper.js";
import { scanAddons } from "../../utils/addonHelper.js";

export function createContext(): SyncDataContext {
    const addons = scanAddons();

    const redisHelper = new RedisHelper();
    const dbHelper: DbHelper = new DbHelper(redisHelper, Connect.getSql());
    const cacheHelper = new CacheHelper({ db: dbHelper, redis: redisHelper });

    return {
        dbHelper: dbHelper,
        redisHelper: redisHelper,
        cacheHelper: cacheHelper,
        addons: addons
    };
}
