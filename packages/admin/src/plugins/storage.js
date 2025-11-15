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
    /**
     * @param {string} namespace
     */
    constructor(namespace = NAMESPACE) {
        this.localStorage = window.localStorage;
        this.sessionStorage = window.sessionStorage;
        this.namespace = namespace;
    }

    /**
     * 生成带命名空间的key
     * @param {string} key
     * @returns {string}
     */
    getKey(key) {
        return `${this.namespace}:${key}`;
    }

    /**
     * 创建存储操作方法
     * @param {Storage} storage
     */
    createStorageOps(storage) {
        return {
            /**
             * 设置存储
             * @param {string} key - 键名
             * @param {any} value - 值（自动序列化）
             * @returns {void}
             */
            set: (key, value) => {
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
             * @template T
             * @param {string} key - 键名
             * @param {T | null} [defaultValue=null] - 默认值
             * @returns {T | null} 解析后的值
             */
            get: (key, defaultValue = null) => {
                try {
                    const fullKey = this.getKey(key);
                    const value = storage.getItem(fullKey);
                    if (value === null) {
                        return defaultValue;
                    }
                    return JSON.parse(value);
                } catch (error) {
                    console.error(`Storage.get error for key "${key}":`, error);
                    return defaultValue;
                }
            },

            /**
             * 删除存储
             * @param {string} key - 键名
             * @returns {void}
             */
            remove: (key) => {
                try {
                    const fullKey = this.getKey(key);
                    storage.removeItem(fullKey);
                } catch (error) {
                    console.error(`Storage.remove error for key "${key}":`, error);
                }
            },

            /**
             * 清空当前命名空间下的所有存储
             * @returns {void}
             */
            clear: () => {
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
             * 判断是否存在某个键
             * @param {string} key - 键名
             * @returns {boolean}
             */
            has: (key) => {
                const fullKey = this.getKey(key);
                return storage.getItem(fullKey) !== null;
            },

            /**
             * 获取所有键名
             * @returns {string[]} 去除命名空间前缀的键名列表
             */
            keys: () => {
                const keys = Object.keys(storage);
                const prefix = `${this.namespace}:`;
                return keys.filter((key) => key.startsWith(prefix)).map((key) => key.substring(prefix.length));
            }
        };
    }

    /**
     * localStorage 操作方法
     */
    get local() {
        return this.createStorageOps(this.localStorage);
    }

    /**
     * sessionStorage 操作方法
     */
    get session() {
        return this.createStorageOps(this.sessionStorage);
    }
}

// 导出单例
export const $Storage = new StorageManager();
