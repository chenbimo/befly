import type { CacheHelper } from "../../lib/cacheHelper.js";
import type { DbHelper } from "../../lib/dbHelper.js";
import type { RedisHelper } from "../../lib/redisHelper.js";
import type { AddonInfo } from "../../utils/scanAddons.js";

export type SyncDataContext = {
    dbHelper: DbHelper;
    redisHelper: RedisHelper;
    cacheHelper: CacheHelper;
    addons: AddonInfo[];
};
