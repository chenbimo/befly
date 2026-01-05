const REGEXP_SPECIAL = /[\\^$.*+?()\[\]{}|]/g;

export function escapeRegExp(input: string): string {
    return String(input).replace(REGEXP_SPECIAL, "\\$&");
}
