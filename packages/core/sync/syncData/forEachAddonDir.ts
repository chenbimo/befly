import type { AddonInfo } from "../../utils/addonHelper.js";

import { Logger } from "../../lib/logger.js";

type ForEachAddonDirOptions = {
    addons: AddonInfo[];
    pickDir: (addon: AddonInfo) => string | null;
    warnMessage: string;
    onDir: (addon: AddonInfo, dirPath: string) => Promise<void>;
};

export async function forEachAddonDir(options: ForEachAddonDirOptions): Promise<void> {
    for (const addon of options.addons) {
        const dirPath = options.pickDir(addon);
        if (!dirPath) {
            continue;
        }

        try {
            await options.onDir(addon, dirPath);
        } catch (error: any) {
            Logger.warn(
                {
                    err: error,
                    addon: addon.name,
                    addonSource: addon.source,
                    dir: dirPath
                },
                options.warnMessage
            );
        }
    }
}
