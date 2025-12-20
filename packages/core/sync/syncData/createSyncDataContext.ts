import type { SyncDataContext } from "./types.js";

import { CacheHelper } from "../../lib/cacheHelper.js";
import { Connect } from "../../lib/connect.js";
import { DbHelper } from "../../lib/dbHelper.js";
import { RedisHelper } from "../../lib/redisHelper.js";

export function createSyncDataContext(): SyncDataContext {
    const redisHelper = new RedisHelper();
    const helper = new DbHelper(redisHelper, Connect.getSql());
    const cacheHelper = new CacheHelper({ db: helper, redis: redisHelper });

    return {
        helper: helper,
        redisHelper: redisHelper,
        cacheHelper: cacheHelper
    };
}
