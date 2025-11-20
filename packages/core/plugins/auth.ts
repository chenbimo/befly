import type { Plugin } from '../types/plugin.js';
import type { BeflyContext } from '../types/befly.js';
import { Jwt } from '../lib/jwt.js';

const plugin: Plugin = {
    pluginName: 'auth',
    after: ['cors'],
    async onInit(this: Plugin, befly: BeflyContext) {
        if (this.config) {
            Jwt.configure(this.config);
        }
        return {};
    },
    onRequest: async (befly, ctx, next) => {
        const authHeader = ctx.request.headers.get('authorization');

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);

            try {
                const payload = await Jwt.verify(token);
                ctx.user = payload;
            } catch (error: any) {
                ctx.user = {};
            }
        } else {
            ctx.user = {};
        }
        await next();
    }
};
export default plugin;
