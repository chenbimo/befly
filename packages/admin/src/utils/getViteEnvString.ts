export function getViteEnvString(key: string): string | undefined {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env;
    return env?.[key];
}
