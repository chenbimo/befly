import { Befly } from 'befly';

export const app = new Befly({
    cors: {
        origin: process.env.CORS_ALLOWED_ORIGIN,
        methods: process.env.CORS_ALLOWED_METHODS
    }
});

await app.start();
