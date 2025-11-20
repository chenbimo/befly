import { Befly } from 'befly';
import { Env } from './env.js';

const app = new Befly({
    plugins: {
        cors: {
            allowOrigin: Env.CORS_ALLOWED_ORIGIN,
            allowMethods: Env.CORS_ALLOWED_METHODS
        }
    }
});
await app.listen();
