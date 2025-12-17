import type { Hook } from "../types/hook.js";

import { setCtxUser } from "../lib/asyncContext.js";

const hook: Hook = {
    order: 3,
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
};
export default hook;
