import type { EmailConfig, SendEmailOptions, SendEmailResult } from "../../libs/emailHelper";
import type { BeflyContext } from "befly/types/befly";

export type AddonAdminEmailPlugin = {
    send: (options: SendEmailOptions) => Promise<SendEmailResult>;
    verify: () => Promise<boolean>;
    getConfig: () => Omit<EmailConfig, "pass"> & { pass: string };
};

export function getAddonAdminEmailPlugin(befly: BeflyContext): AddonAdminEmailPlugin | null {
    const plugin = befly["addon_admin_email"];
    if (typeof plugin !== "object" || plugin === null) return null;

    const record = plugin as Record<string, unknown>;

    if (typeof record["send"] !== "function") return null;
    if (typeof record["verify"] !== "function") return null;
    if (typeof record["getConfig"] !== "function") return null;

    return plugin as AddonAdminEmailPlugin;
}
