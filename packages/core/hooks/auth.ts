import type { Hook } from "../types/hook";

import { setCtxUser } from "../lib/asyncContext";

export default {
    name: "auth",
    enable: true,
    deps: ["cors"],
    handler: async (befly, ctx) => {
        const authHeader = ctx.req.headers.get("authorization");

        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.substring(7);

            try {
                const payload = await befly.jwt.verify(token);
                ctx.user = payload;

                setCtxUser(payload.id, payload.roleCode, payload.nickname, payload.roleType);
            } catch {
                ctx.user = {};
            }
        } else {
            ctx.user = {};
        }
    }
} satisfies Hook;
