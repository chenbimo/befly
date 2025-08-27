import { Logger } from './logger.js';
import { RYes, RNo } from './index.js';
export class Api {
    // GET 方法
    static GET(name, auth = false, fields = {}, required = [], handler) {
        return {
            method: 'GET',
            name: name,
            auth: auth,
            fields: fields,
            required: required,
            handler: async (befly, ctx, req) => await handler(befly, ctx, req)
        };
    }

    // POST 方法
    static POST(name, auth = false, fields = {}, required = [], handler) {
        return {
            method: 'POST',
            name: name,
            auth: auth,
            fields: fields,
            required: required,
            handler: async (befly, ctx, req) => await handler(befly, ctx, req)
        };
    }
}
