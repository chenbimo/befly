/**
 * Storage 封装
 * 支持命名空间隔离，统一管理 localStorage 和 sessionStorage
 */

// 获取命名空间
const NAMESPACE = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_STORAGE_NAMESPACE || "befly";

class MemoryStorage implements Storage {
    private map: Map<string, string>;

    public constructor() {
        this.map = new Map<string, string>();
    }

    public get length(): number {
        return this.map.size;
    }

    public clear(): void {
        for (const key of this.map.keys()) {
            delete (this as unknown as Record<string, unknown>)[key];
        }
        this.map.clear();
    }

    public getItem(key: string): string | null {
        return this.map.get(key) ?? null;
    }

    public key(index: number): string | null {
        const keys = Array.from(this.map.keys());
        return keys[index] ?? null;
    }

    public removeItem(key: string): void {
        this.map.delete(key);
        delete (this as unknown as Record<string, unknown>)[key];
    }

    public setItem(key: string, value: string): void {
        this.map.set(key, value);
        (this as unknown as Record<string, unknown>)[key] = value;
    }
}

function getBrowserStorage(kind: "localStorage" | "sessionStorage"): Storage {
    const win = globalThis as unknown as { window?: { localStorage?: Storage; sessionStorage?: Storage } };
    const storage = win.window?.[kind];
    if (storage) {
        return storage;
    }
    return new MemoryStorage();
}

type StorageOps = {
    set: (key: string, value: unknown) => void;
    get: {
        (key: string): string | null;
        (key: string, defaultValue: string | null): string | null;
        <T>(key: string, defaultValue: T): T;
    };
    remove: (key: string) => void;
    clear: () => void;
    has: (key: string) => boolean;
    keys: () => string[];
};

/**
 * 存储操作类
 */
class StorageManager {
    private localStorage: Storage;
    private sessionStorage: Storage;
    private namespace: string;

    public constructor(namespace: string = NAMESPACE) {
        this.localStorage = getBrowserStorage("localStorage");
        this.sessionStorage = getBrowserStorage("sessionStorage");
        this.namespace = namespace;
    }

    private getKey(key: string): string {
        return `${this.namespace}:${key}`;
    }

    private createStorageOps(storage: Storage): StorageOps {
        return {
            set: (key: string, value: unknown) => {
                try {
                    const fullKey = this.getKey(key);
                    const serializedValue = JSON.stringify(value);
                    storage.setItem(fullKey, serializedValue);
                } catch {
                    // ignore
                }
            },

            get: ((key: string, defaultValue?: unknown) => {
                try {
                    const fullKey = this.getKey(key);
                    const value = storage.getItem(fullKey);
                    if (value === null) {
                        return defaultValue ?? null;
                    }
                    return JSON.parse(value) as unknown;
                } catch {
                    return defaultValue ?? null;
                }
            }) as StorageOps["get"],

            remove: (key: string) => {
                try {
                    const fullKey = this.getKey(key);
                    storage.removeItem(fullKey);
                } catch {
                    // ignore
                }
            },

            clear: () => {
                try {
                    const keys = Object.keys(storage);
                    const prefix = `${this.namespace}:`;
                    keys.forEach((key) => {
                        if (key.startsWith(prefix)) {
                            storage.removeItem(key);
                        }
                    });
                } catch {
                    // ignore
                }
            },

            has: (key: string) => {
                const fullKey = this.getKey(key);
                return storage.getItem(fullKey) !== null;
            },

            keys: () => {
                const keys = Object.keys(storage);
                const prefix = `${this.namespace}:`;
                return keys.filter((key) => key.startsWith(prefix)).map((key) => key.substring(prefix.length));
            }
        };
    }

    public get local(): StorageOps {
        return this.createStorageOps(this.localStorage);
    }

    public get session(): StorageOps {
        return this.createStorageOps(this.sessionStorage);
    }
}

// 导出单例
export const $Storage = new StorageManager();
