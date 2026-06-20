"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_js_1 = require("./app.js");
const PORT = parseInt(process.env['API_PORT'] ?? '3000', 10);
async function main() {
    const app = await (0, app_js_1.buildApp)();
    const shutdown = async (signal) => {
        app.log.info(`${signal} received — shutting down`);
        await app.close(); // drains in-flight requests before closing
        process.exit(0);
    };
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
    try {
        await app.listen({ port: PORT, host: '0.0.0.0' });
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}
main();
