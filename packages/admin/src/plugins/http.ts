import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';

// API 响应格式
interface ApiResponse<T = any> {
    code: 0 | 1;
    msg: string;
    data: T;
}

// 创建 axios 实例
const request: AxiosInstance = axios.create({
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
        const token = localStorage.getItem('token');
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
    (response: AxiosResponse<ApiResponse>) => {
        const res = response.data;

        // 如果code不是0,说明业务失败
        if (res.code !== 0) {
            Message.error(res.msg || '请求失败');
            return Promise.reject(new Error(res.msg || '请求失败'));
        }

        return res;
    },
    (error) => {
        console.error('[Response] 响应错误:', error);

        // 处理HTTP错误状态
        if (error.response) {
            switch (error.response.status) {
                case 401:
                    Message.error('未授权,请重新登录');
                    localStorage.removeItem('token');
                    window.location.href = '/login';
                    break;
                case 403:
                    Message.error('拒绝访问');
                    break;
                case 404:
                    Message.error('请求的资源不存在');
                    break;
                case 500:
                    Message.error('服务器错误');
                    break;
                default:
                    Message.error(error.response.data?.msg || '请求失败');
            }
        } else {
            Message.error('网络连接失败');
        }

        return Promise.reject(error);
    }
);

/**
 * 统一的 HTTP 请求方法（仅支持 GET 和 POST）
 * @param url - 请求路径
 * @param data - 请求数据，默认为空对象
 * @param method - 请求方法，默认为 'post'，可选 'get' | 'post'
 * @param config - axios 请求配置
 * @returns Promise<ApiResponse<T>>
 *
 * @example
 * // POST 请求（默认）
 * await $Http('/addon/admin/login', { email, password });
 *
 * // GET 请求
 * await $Http('/addon/admin/info', {}, 'get');
 */
export function $Http<T = any>(url: string, data: any = {}, method: 'get' | 'post' = 'post', config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const methodLower = method.toLowerCase() as 'get' | 'post';

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
