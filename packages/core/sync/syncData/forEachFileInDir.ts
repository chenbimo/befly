import { Logger } from "../../lib/logger.js";
import { scanFiles } from "../../utils/scanFiles.js";

type ForEachFileInDirOptions = {
    dirPath: string;
    warnMessage: string;
    onFile: (filePath: string) => Promise<void>;
    extraLogFields?: Record<string, unknown>;
};

export async function forEachFileInDir(options: ForEachFileInDirOptions): Promise<void> {
    let files: Array<{ filePath: string }> = [];

    try {
        files = await scanFiles(options.dirPath);
    } catch (error: any) {
        const logFields: Record<string, unknown> = { err: error, dir: options.dirPath };
        if (options.extraLogFields) {
            for (const [key, value] of Object.entries(options.extraLogFields)) {
                (logFields as any)[key] = value;
            }
        }

        Logger.warn(logFields, options.warnMessage);
        return;
    }

    for (const item of files) {
        try {
            await options.onFile(item.filePath);
        } catch (error: any) {
            const logFields: Record<string, unknown> = { err: error, dir: options.dirPath, file: item.filePath };
            if (options.extraLogFields) {
                for (const [key, value] of Object.entries(options.extraLogFields)) {
                    (logFields as any)[key] = value;
                }
            }

            Logger.warn(logFields, options.warnMessage);
        }
    }
}
