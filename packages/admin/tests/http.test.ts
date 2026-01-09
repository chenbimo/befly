import { beforeAll, afterAll, describe, expect, test } from "bun:test";

import axios from "axios";

type ApiResponse = {
    code: number;
    msg?: string;
    data?: unknown;
};

type AxiosResponseLike = {
    data: ApiResponse;
};

type RequestStub = {
    interceptors: {
        request: {
            use: (onFulfilled: unknown, onRejected?: unknown) => unknown;
        };
    };
    get: (url: string, config?: unknown) => Promise<AxiosResponseLike>;
    post: (url: string, data?: unknown, config?: unknown) => Promise<AxiosResponseLike>;
};

describe("$Http", () => {
    const getCalls: Array<{ url: string; config: unknown }> = [];
    const postCalls: Array<{ url: string; data: unknown; config: unknown }> = [];

    const requestStub: RequestStub = {
        interceptors: {
            request: {
                use: (_onFulfilled: unknown, _onRejected?: unknown) => {
                    return undefined;
                }
            }
        },
        get: async (url: string, config?: unknown) => {
            getCalls.push({ url: url, config: config });
            return {
                data: {
                    code: 0,
                    data: null
                }
            };
        },
        post: async (url: string, data?: unknown, config?: unknown) => {
            postCalls.push({ url: url, data: data, config: config });
            return {
                data: {
                    code: 0,
                    data: null
                }
            };
        }
    };

    const axiosDefault = axios as unknown as { create: (config: unknown) => unknown };
    const originalCreate = axiosDefault.create;

    let $Http: typeof import("../src/plugins/http").$Http;

    beforeAll(async () => {
        axiosDefault.create = (_config: unknown) => {
            return requestStub;
        };

        const mod = await import("../src/plugins/http");
        $Http = mod.$Http;
    });

    afterAll(() => {
        axiosDefault.create = originalCreate;
    });

    test("post 未传 data 时也要发送空对象 body", async () => {
        postCalls.length = 0;

        await $Http.post("/test/post-no-data");

        expect(postCalls.length).toBe(1);
        const call = postCalls[0];
        expect(call).toBeTruthy();
        expect(call?.url).toBe("/test/post-no-data");
        expect(call?.data).toEqual({});
    });

    test("get 未传 data 时也要发送空对象 params", async () => {
        getCalls.length = 0;

        await $Http.get("/test/get-no-data");

        expect(getCalls.length).toBe(1);
        const call = getCalls[0];
        expect(call).toBeTruthy();
        expect(call?.url).toBe("/test/get-no-data");
        const cfg = call?.config as undefined | { params?: unknown };
        expect(cfg?.params).toEqual({});
    });

    test("get data 清洗为空时也要发送空对象 params", async () => {
        getCalls.length = 0;

        await $Http.get(
            "/test/get-empty-after-clean",
            {
                keyword: ""
            },
            {
                dropValues: [""]
            }
        );

        expect(getCalls.length).toBe(1);
        const call = getCalls[0];
        expect(call).toBeTruthy();
        expect(call?.url).toBe("/test/get-empty-after-clean");

        const cfg = call?.config as undefined | { params?: unknown };
        expect(cfg?.params).toEqual({});
    });

    test("post 第三参 dropKeyValue 可覆盖 dropValues（page=0 必须保留）", async () => {
        postCalls.length = 0;

        await $Http.post(
            "/test/post-clean",
            {
                page: 0,
                keyword: "",
                other: 0,
                nil: null
            },
            {
                dropValues: [0, ""],
                dropKeyValue: {
                    page: [],
                    keyword: [""]
                }
            }
        );

        expect(postCalls.length).toBe(1);
        const call = postCalls[0];
        expect(call).toBeTruthy();
        expect(call?.url).toBe("/test/post-clean");
        expect(call?.data).toEqual({ page: 0 });
    });

    test("post 传 FormData 时应原样透传", async () => {
        postCalls.length = 0;

        const fd = new FormData();
        fd.append("a", "1");

        await $Http.post("/test/post-formdata", fd);

        expect(postCalls.length).toBe(1);
        const call = postCalls[0];
        expect(call).toBeTruthy();
        expect(call?.url).toBe("/test/post-formdata");
        expect(call?.data).toBe(fd);
    });

    test("post 传 FormData + options(headers) 时应原样透传且 config 透传", async () => {
        postCalls.length = 0;

        const fd = new FormData();
        fd.append("a", "1");

        await $Http.post("/test/post-formdata-with-config", fd, {
            headers: {
                "X-Test": "1"
            }
        });

        expect(postCalls.length).toBe(1);
        const call = postCalls[0];
        expect(call).toBeTruthy();
        expect(call?.url).toBe("/test/post-formdata-with-config");
        expect(call?.data).toBe(fd);
        expect(call?.config).toEqual({
            headers: {
                "X-Test": "1"
            }
        });
    });

    test("get 未传 data/options 时也要发送空对象 params", async () => {
        getCalls.length = 0;

        await $Http.get("/test/get-no-data-no-options");

        expect(getCalls.length).toBe(1);
        const call = getCalls[0];
        expect(call).toBeTruthy();
        expect(call?.url).toBe("/test/get-no-data-no-options");

        const cfg = call?.config as undefined | { params?: unknown };
        expect(cfg?.params).toEqual({});
    });

    test("get 仅 dropKeyValue 清洗为空时也要发送空对象 params", async () => {
        getCalls.length = 0;

        await $Http.get(
            "/test/get-empty-after-dropKeyValue",
            {
                keyword: ""
            },
            {
                dropKeyValue: {
                    keyword: [""]
                }
            }
        );

        expect(getCalls.length).toBe(1);
        const call = getCalls[0];
        expect(call).toBeTruthy();
        expect(call?.url).toBe("/test/get-empty-after-dropKeyValue");

        const cfg = call?.config as undefined | { params?: unknown };
        expect(cfg?.params).toEqual({});
    });
});
