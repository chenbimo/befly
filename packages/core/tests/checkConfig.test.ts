import { checkConfig } from "../checks/checkConfig";

describe("checkConfig", () => {
    test("MySQL 必须提供非空 host", async () => {
        await expect(
            checkConfig({
                nodeEnv: "development",
                strict: true,
                appName: "t",
                db: {
                    host: "",
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
        ).rejects.toThrow(/db\.host/);
    });
});
