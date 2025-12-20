import type { CacheHelper } from "../../lib/cacheHelper.js";
import type { DbHelper } from "../../lib/dbHelper.js";
import type { RedisHelper } from "../../lib/redisHelper.js";

export type SyncDataContext = {
    helper: DbHelper;
    redisHelper: RedisHelper;
    cacheHelper: CacheHelper;
};
