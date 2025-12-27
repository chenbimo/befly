function toErrorArray(params: { error?: unknown; errors?: unknown[] }) {
    if (params.errors && params.errors.length > 0) {
        return params.errors;
    }

    if (typeof params.error === "undefined") {
        return [];
    }

    return [params.error];
}

function getSingleErrorMsg(error: unknown) {
    const anyError = error as any;
    const msg = anyError?.data?.msg || anyError?.msg || anyError?.message;
    if (!msg) {
        return "";
    }
    return String(msg);
}

function getMergedErrorMsg(params: { errors: unknown[]; fallbackMsg: string; separator: string }) {
    const messages: string[] = [];
    const used = new Set<string>();

    for (const item of params.errors) {
        const msg = getSingleErrorMsg(item);
        if (!msg) {
            continue;
        }
        if (used.has(msg)) {
            continue;
        }

        used.add(msg);
        messages.push(msg);
    }

    if (messages.length === 0) {
        return params.fallbackMsg;
    }

    return messages.join(params.separator);
}

export function notifyError(params: { error?: unknown; errors?: unknown[]; fallbackMsg?: string; silent?: boolean; separator?: string }) {
    if (params.silent) {
        return;
    }

    const errors = toErrorArray({ error: params.error, errors: params.errors });
    const fallbackMsg = typeof params.fallbackMsg === "string" ? String(params.fallbackMsg) : "";
    const separator = typeof params.separator === "string" && params.separator ? String(params.separator) : "；";

    const msg = getMergedErrorMsg({ errors: errors, fallbackMsg: fallbackMsg, separator: separator });
    if (!msg) {
        return;
    }

    return msg;
}
