import { Befly, sync } from 'befly';

export const app = new Befly({
    plugins: {
        cors: {
            origin: process.env.CORS_ALLOWED_ORIGIN,
            methods: process.env.CORS_ALLOWED_METHODS
        }
    }
});

if (import.meta.main) {
    await sync();
    await app.listen();
}
