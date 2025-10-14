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
            MessagePlugin.error(res.msg || '请求失败');
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
                    MessagePlugin.error('未授权,请重新登录');
                    localStorage.removeItem('token');
                    window.location.href = '/login';
                    break;
                case 403:
                    MessagePlugin.error('拒绝访问');
                    break;
                case 404:
                    MessagePlugin.error('请求的资源不存在');
                    break;
                case 500:
                    MessagePlugin.error('服务器错误');
                    break;
                default:
                    MessagePlugin.error(error.response.data?.msg || '请求失败');
            }
        } else {
            MessagePlugin.error('网络连接失败');
        }

        return Promise.reject(error);
    }
);

// 封装请求方法
export const http = {
    get<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
        return request.get(url, config);
    },

    post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
        return request.post(url, data, config);
    },

    put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
        return request.put(url, data, config);
    },

    delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
        return request.delete(url, config);
    }
};

export default request;
