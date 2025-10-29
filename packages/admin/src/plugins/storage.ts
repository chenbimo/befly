/**
 * Storage 封装
 * 支持命名空间隔离，统一管理 localStorage 和 sessionStorage
 */

// 获取命名空间
const NAMESPACE = import.meta.env.VITE_STORAGE_NAMESPACE || 'befly';

/**
 * 存储操作类
 */
class StorageManager {
    private localStorage: Storage;
    private sessionStorage: Storage;
    private namespace: string;

    constructor(namespace: string = NAMESPACE) {
        this.localStorage = window.localStorage;
        this.sessionStorage = window.sessionStorage;
        this.namespace = namespace;
    }

    /**
     * 生成带命名空间的key
     */
    private getKey(key: string): string {
        return `${this.namespace}:${key}`;
    }

    /**
     * 创建存储操作方法
     */
    private createStorageOps(storage: Storage) {
        return {
            /**
             * 设置存储
             * @param key 键名
             * @param value 值（自动序列化）
             */
            set: (key: string, value: any): void => {
                try {
                    const fullKey = this.getKey(key);
                    const serializedValue = JSON.stringify(value);
                    storage.setItem(fullKey, serializedValue);
                } catch (error) {
                    console.error(`Storage.set error for key "${key}":`, error);
                }
            },

            /**
             * 获取存储
             * @param key 键名
             * @param defaultValue 默认值
             * @returns 解析后的值
             */
            get: <T = any>(key: string, defaultValue: T | null = null): T | null => {
                try {
                    const fullKey = this.getKey(key);
                    const value = storage.getItem(fullKey);
                    if (value === null) {
                        return defaultValue;
                    }
                    return JSON.parse(value) as T;
                } catch (error) {
                    console.error(`Storage.get error for key "${key}":`, error);
                    return defaultValue;
                }
            },

            /**
             * 删除存储
             * @param key 键名
             */
            remove: (key: string): void => {
                try {
                    const fullKey = this.getKey(key);
                    storage.removeItem(fullKey);
                } catch (error) {
                    console.error(`Storage.remove error for key "${key}":`, error);
                }
            },

            /**
             * 清空当前命名空间下的所有存储
             */
            clear: (): void => {
                try {
                    const keys = Object.keys(storage);
                    const prefix = `${this.namespace}:`;
                    keys.forEach((key) => {
                        if (key.startsWith(prefix)) {
                            storage.removeItem(key);
                        }
                    });
                } catch (error) {
                    console.error('Storage.clear error:', error);
                }
            },

            /**
             * 检查键是否存在
             * @param key 键名
             * @returns 是否存在
             */
            has: (key: string): boolean => {
                try {
                    const fullKey = this.getKey(key);
                    return storage.getItem(fullKey) !== null;
                } catch (error) {
                    console.error(`Storage.has error for key "${key}":`, error);
                    return false;
                }
            },

            /**
             * 获取所有当前命名空间的键
             * @returns 键名数组（不含命名空间前缀）
             */
            keys: (): string[] => {
                try {
                    const allKeys = Object.keys(storage);
                    const prefix = `${this.namespace}:`;
                    return allKeys.filter((key) => key.startsWith(prefix)).map((key) => key.replace(prefix, ''));
                } catch (error) {
                    console.error('Storage.keys error:', error);
                    return [];
                }
            }
        };
    }

    /** localStorage 操作 */
    get local() {
        return this.createStorageOps(this.localStorage);
    }

    /** sessionStorage 操作 */
    get session() {
        return this.createStorageOps(this.sessionStorage);
    }
}

/**
 * 统一的存储操作对象（单例）
 */
export const $Storage = new StorageManager();
