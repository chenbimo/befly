import { join } from 'pathe';
import { Logger } from '../util';
import { writeFile, unlink } from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export async function listPluginsCommand() {
    const tempScriptPath = join(process.cwd(), 'temp', 'list-plugins-script.ts');

    const scriptContent = `
import { loadPlugins } from 'befly';
import { Logger } from 'befly/lib/logger';

// Mock Logger to avoid noise
Logger.info = () => {};
Logger.warn = () => {};
Logger.error = console.error;

async function main() {
    try {
        const plugins = [];
        const appContext = {};

        // Load plugins using the core loader
        // This will scan core plugins and project plugins
        await loadPlugins({
            pluginLists: plugins,
            appContext: appContext
        });

        console.log(JSON.stringify(plugins.map(p => ({
            name: p.pluginName,
            after: p.after || []
        })), null, 2));
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
`;

    try {
        // Ensure temp dir exists
        // (Assuming temp dir exists as per project structure, or we can create it)

        await writeFile(tempScriptPath, scriptContent, 'utf-8');

        // Run the script with bun
        const { stdout, stderr } = await execAsync(`bun run ${tempScriptPath}`);

        if (stderr) {
            // Some warnings might go to stderr, but if it fails we usually get exit code
            // We'll just log it if it looks like an error
            if (stderr.includes('error') || stderr.includes('Error')) {
                Logger.error('Error listing plugins:', stderr);
            }
        }

        try {
            const plugins = JSON.parse(stdout);
            Logger.info('Loaded Plugins:');
            console.table(plugins);
        } catch (e) {
            Logger.error('Failed to parse plugin list:', stdout);
        }
    } catch (error: any) {
        Logger.error('Failed to list plugins:', error.message);
    } finally {
        // Cleanup
        try {
            await unlink(tempScriptPath);
        } catch (e) {
            // Ignore cleanup error
        }
    }
}
