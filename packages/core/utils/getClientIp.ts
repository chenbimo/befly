/**
 * 获取客户端 IP（优先代理头，其次 Bun server.requestIP 兜底）
 *
 * 注意：目前策略是“尽量取到 IP”，未做 trustProxy 防伪造控制。
 */
export function getClientIp(req: Request, server?: any): string {
    // 1) 代理/网关常见头（优先取）
    const xForwardedFor = req.headers.get("x-forwarded-for");
    if (typeof xForwardedFor === "string" && xForwardedFor.trim()) {
        const first = xForwardedFor.split(",")[0];
        if (typeof first === "string" && first.trim()) {
            return first.trim();
        }
    }

    const xRealIp = req.headers.get("x-real-ip");
    if (typeof xRealIp === "string" && xRealIp.trim()) {
        return xRealIp.trim();
    }

    const cfConnectingIp = req.headers.get("cf-connecting-ip");
    if (typeof cfConnectingIp === "string" && cfConnectingIp.trim()) {
        return cfConnectingIp.trim();
    }

    const xClientIp = req.headers.get("x-client-ip");
    if (typeof xClientIp === "string" && xClientIp.trim()) {
        return xClientIp.trim();
    }

    const trueClientIp = req.headers.get("true-client-ip");
    if (typeof trueClientIp === "string" && trueClientIp.trim()) {
        return trueClientIp.trim();
    }

    // 2) 连接层兜底：Bun server.requestIP(req)
    if (server && typeof server.requestIP === "function") {
        const ipInfo = server.requestIP(req);
        if (ipInfo && typeof ipInfo.address === "string" && ipInfo.address.trim()) {
            return ipInfo.address.trim();
        }
    }

    return "unknown";
}
