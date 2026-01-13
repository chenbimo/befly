import { checkConfig } from "../checks/checkConfig";

describe("checkConfig", () => {
    test("应拒绝非法 db.dialect", async () => {
        await expect(
            checkConfig({
                nodeEnv: "development",
                appName: "t",
                db: {
                    dialect: "mongodb" as any,
                    host: "127.0.0.1",
                    port: 3306,
                    username: "root",
                    password: "root",
                    database: "x",
                    poolMax: 1
                },
                redis: {
                    host: "127.0.0.1",
                    port: 6379,
                    db: 0,
                    prefix: "t"
                }
            })
        ).rejects.toThrow(/db\.dialect/);
    });

    test("sqlite 必须提供非空 database", async () => {
        await expect(
            checkConfig({
                nodeEnv: "development",
                appName: "t",
                db: {
                    dialect: "sqlite",
                    database: ""
                },
                redis: {
                    host: "127.0.0.1",
                    port: 6379,
                    db: 0,
                    prefix: "t"
                }
            })
        ).rejects.toThrow(/db\.database/);
    });
});
