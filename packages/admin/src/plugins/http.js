import axios from 'axios';
import { Modal } from '@opentiny/vue';
import { $Storage } from './storage';

/**
 * @typedef {Object} ApiResponse
 * @property {0 | 1} code
 * @property {string} msg
 * @property {any} data
 */

// 创建 axios 实例
const request = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// 请求拦截器
request.interceptors.request.use(
    (config) => {
        // 添加 token
        const token = $Storage.local.get('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
            // 开发环境下打印 token 信息
            if (import.meta.env.DEV) {
                console.log('[HTTP] 请求携带 token:', token.substring(0, 20) + '...');
            }
        } else {
            if (import.meta.env.DEV) {
                console.log('[HTTP] 请求未携带 token');
            }
        }
        return config;
    },
    (error) => {
        console.error('[Request] 请求错误:', error);
        return Promise.reject(error);
    }
);

// 响应拦截器
request.interceptors.response.use(
    (response) => {
        const res = response.data;

        // 如果code不是0,说明业务失败
        if (res.code !== 0) {
            Modal.message({
                message: res.msg || '请求失败',
                status: 'error'
            });
            return Promise.reject(res.data);
        }

        return res;
    },
    (error) => {
        Modal.message({ message: '网络连接失败', status: 'error' });
        return Promise.reject(error);
    }
);

/**
 * 统一的 HTTP 请求方法（仅支持 GET 和 POST）
 * @template T
 * @param {string} url - 请求路径
 * @param {any} [data={}] - 请求数据，默认为空对象
 * @param {'get' | 'post'} [method='post'] - 请求方法，默认为 'post'，可选 'get' | 'post'
 * @param {import('axios').AxiosRequestConfig} [config] - axios 请求配置
 * @returns {Promise<ApiResponse>}
 */
export function $Http(url, data = {}, method = 'post', config) {
    const methodLower = method.toLowerCase();

    // GET 请求将 data 作为 params
    if (methodLower === 'get') {
        return request.get(url, {
            ...config,
            params: data
        });
    }

    // POST 请求将 data 作为 body
    return request.post(url, data, config);
}
