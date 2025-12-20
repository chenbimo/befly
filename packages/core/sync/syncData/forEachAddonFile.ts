import type { AddonInfo } from "../../utils/addonHelper.js";

import { forEachAddonDir } from "./forEachAddonDir.js";
import { forEachFileInDir } from "./forEachFileInDir.js";

type ForEachAddonFileOptions = {
    addons: AddonInfo[];
    pickDir: (addon: AddonInfo) => string | null;
    warnMessage: string;
    onFile: (addon: AddonInfo, dirPath: string, filePath: string) => Promise<void>;
};

export async function forEachAddonFile(options: ForEachAddonFileOptions): Promise<void> {
    await forEachAddonDir({
        addons: options.addons,
        pickDir: options.pickDir,
        warnMessage: options.warnMessage,
        onDir: async (addon, dirPath) => {
            await forEachFileInDir({
                dirPath: dirPath,
                warnMessage: options.warnMessage,
                extraLogFields: {
                    addon: addon.name,
                    addonDir: dirPath
                },
                onFile: async (filePath) => {
                    await options.onFile(addon, dirPath, filePath);
                }
            });
        }
    });
}
