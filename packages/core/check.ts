import { Glob } from 'bun';
import { join } from 'node:path';
import { Logger } from './lib/logger.js';

// Default execution order (filenames without extension)
const DEFAULT_ORDER = ['checkApp', 'checkTable', 'checkApi'];

/**
 * Run all checks in the checks directory
 * @param customOrder Optional custom order of checks (filenames without extension)
 * @returns Promise<boolean> True if all checks passed, false otherwise
 */
export async function runChecks(customOrder?: string[]): Promise<boolean> {
    const checksDir = join(import.meta.dir, 'checks');
    const glob = new Glob('*.ts');
    const checkFiles: string[] = [];

    // 1. Scan files
    for await (const file of glob.scan(checksDir)) {
        checkFiles.push(file);
    }

    // 2. Sort files based on order
    const order = customOrder || DEFAULT_ORDER;
    checkFiles.sort((a, b) => {
        const nameA = a.replace(/\.ts$/, '');
        const nameB = b.replace(/\.ts$/, '');
        const indexA = order.indexOf(nameA);
        const indexB = order.indexOf(nameB);

        // If both are in order list, sort by index
        if (indexA !== -1 && indexB !== -1) {
            return indexA - indexB;
        }
        // If only A is in order, A comes first
        if (indexA !== -1) return -1;
        // If only B is in order, B comes first
        if (indexB !== -1) return 1;
        // If neither, sort alphabetically
        return nameA.localeCompare(nameB);
    });

    // 3. Execute checks
    for (const file of checkFiles) {
        const name = file.replace(/\.ts$/, '');
        try {
            const modulePath = join(checksDir, file);
            // Use dynamic import
            const module = await import(modulePath);
            const checkFn = module.default;

            if (typeof checkFn !== 'function') {
                Logger.warn(`Check file ${file} does not export a default function.`);
                continue;
            }

            const result = await checkFn();
            if (!result) {
                Logger.error(`Check failed: ${name}`);
                return false;
            }
        } catch (error) {
            Logger.error(`Error running check ${name}:`, error);
            return false;
        }
    }

    return true;
}
