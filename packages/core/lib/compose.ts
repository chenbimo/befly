
import type { BeflyContext } from '../types/befly.js';
import type { RequestContext } from '../types/context.js';
import type { PluginRequestHook, Next } from '../types/plugin.js';

/**
 * Compose middleware functions into a single function
 * Based on koa-compose
 */
export function compose(middleware: PluginRequestHook[]) {
    return function (befly: BeflyContext, ctx: RequestContext, next?: Next) {
        let index = -1;
        return dispatch(0);

        function dispatch(i: number): Promise<void> {
            if (i <= index) return Promise.reject(new Error('next() called multiple times'));
            index = i;
            let fn = middleware[i];
            if (i === middleware.length) fn = next as PluginRequestHook;
            if (!fn) return Promise.resolve();
            try {
                return Promise.resolve(fn(befly, ctx, dispatch.bind(null, i + 1)));
            } catch (err) {
                return Promise.reject(err);
            }
        }
    };
}
