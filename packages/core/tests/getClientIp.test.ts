import { describe, expect, test } from "bun:test";

import { getClientIp } from "../utils/getClientIp";

describe("utils - getClientIp", () => {
    test("优先使用 x-forwarded-for 的第一个值", () => {
        const req = new Request("http://localhost/api/test", {
            method: "GET",
            headers: {
                "x-forwarded-for": " 8.8.8.8, 1.1.1.1 "
            }
        });

        const ip = getClientIp(req);
        expect(ip).toBe("8.8.8.8");
    });

    test("x-forwarded-for 为空时回退到 x-real-ip", () => {
        const req = new Request("http://localhost/api/test", {
            method: "GET",
            headers: {
                "x-forwarded-for": "   ",
                "x-real-ip": "9.9.9.9"
            }
        });

        const ip = getClientIp(req);
        expect(ip).toBe("9.9.9.9");
    });

    test("无代理头时使用 server.requestIP(req) 兜底", () => {
        const req = new Request("http://localhost/api/test", {
            method: "GET"
        });

        const server = {
            requestIP(_req: Request) {
                return { address: "7.7.7.7" };
            }
        };

        const ip = getClientIp(req, server);
        expect(ip).toBe("7.7.7.7");
    });

    test("全都没有时返回 unknown", () => {
        const req = new Request("http://localhost/api/test", {
            method: "GET"
        });

        const ip = getClientIp(req);
        expect(ip).toBe("unknown");
    });
});
