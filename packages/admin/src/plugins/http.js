import axios from "axios";
import { MessagePlugin } from "tdesign-vue-next";

import { $Storage } from "./storage";

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
        "Content-Type": "application/json"
    }
});

// 请求拦截器
request.interceptors.request.use(
    (config) => {
        // 添加 token
        const token = $Storage.local.get("token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// 响应拦截器
request.interceptors.response.use(
    (response) => {
        const res = response.data;

        // 如果code不是0,说明业务失败（不显示提示，由业务层处理）
        if (res.code !== 0) {
            return Promise.reject({
                code: res.code,
                msg: res.msg || "请求失败",
                data: res.data
            });
        }

        // 成功时返回 data
        return res;
    },
    (error) => {
        MessagePlugin.error("网络连接失败");
        return Promise.reject({
            code: -1,
            msg: "网络连接失败",
            error: error
        });
    }
);

/**
 * 统一的 HTTP 请求方法（仅支持 GET 和 POST）
 * @template T
 * @param {string} url - 请求路径
 * @param {any} [data={}] - 请求数据，默认为空对象
 * @param {'get' | 'post'} [method='post'] - 请求方法，默认为 'post'，可选 'get' | 'post'
 * @param {import('axios').AxiosRequestConfig} [config] - axios 请求配置
 * @returns {Promise<any>} 成功返回 data，失败抛出 {code, msg, data} 对象
 */
export function $Http(url, data = {}, method = "post", config) {
    const methodLower = method.toLowerCase();

    // GET 请求将 data 作为 params
    if (methodLower === "get") {
        return request.get(url, {
            ...config,
            params: data
        });
    }

    // POST 请求将 data 作为 body
    return request.post(url, data, config);
}
