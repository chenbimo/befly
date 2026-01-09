import axios, { AxiosHeaders, type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";

import { cleanParams } from "../utils/cleanParams";
import { getViteEnvString } from "../utils/getViteEnvString";
import { $Storage } from "./storage";

export type HttpApiResponse<TData> = {
    code: number;
    msg?: string;
    data?: TData;
};

export type HttpCleanParamsOptions = {
    dropValues?: readonly unknown[];
    dropKeyValue?: Record<string, readonly unknown[]>;
};

export type HttpClientOptions = AxiosRequestConfig & HttpCleanParamsOptions;

function toAxiosRequestConfig(options: HttpClientOptions | undefined): AxiosRequestConfig | undefined {
    if (!options) {
        return undefined;
    }

    const out = Object.assign({}, options) as Record<string, unknown>;
    delete out["dropValues"];
    delete out["dropKeyValue"];

    if (Object.keys(out).length === 0) {
        return undefined;
    }

    return out as AxiosRequestConfig;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    if (typeof value !== "object" || value === null) return false;
    if (Array.isArray(value)) return false;
    if (value instanceof FormData) return false;
    return true;
}

function maybeCleanRequestData(data: Record<string, unknown>, cleanOptions: HttpCleanParamsOptions | undefined): Record<string, unknown> {
    if (!isPlainRecord(data)) {
        return data;
    }

    const dropValues = cleanOptions?.dropValues;
    const dropKeyValue = cleanOptions?.dropKeyValue;
    return cleanParams(data, dropValues ?? [], dropKeyValue);
}

class HttpError extends Error {
    public code: number;
    public data?: unknown;
    public rawError?: unknown;

    public constructor(code: number, msg: string, data?: unknown, rawError?: unknown) {
        super(msg);
        this.name = "HttpError";
        this.code = code;
        this.data = data;
        this.rawError = rawError;
    }
}

function isNormalizedHttpError(value: unknown): value is HttpError {
    return value instanceof HttpError;
}

async function showNetworkErrorToast(): Promise<void> {
    // 在测试/非浏览器环境下，tdesign-vue-next 可能不可用；仅在需要展示提示时再加载。
    try {
        const mod = await import("tdesign-vue-next");
        mod.MessagePlugin.error("网络连接失败");
    } catch {
        // ignore
    }
}

async function unwrapApiResponse<TData>(promise: Promise<AxiosResponse<HttpApiResponse<TData>>>): Promise<HttpApiResponse<TData>> {
    try {
        const response = await promise;
        const res = response.data;

        if (res.code !== 0) {
            throw new HttpError(res.code, res.msg || "请求失败", res.data);
        }

        return res;
    } catch (error) {
        // 业务错误：不显示提示，由业务层处理
        if (isNormalizedHttpError(error)) {
            throw error;
        }

        await showNetworkErrorToast();
        throw new HttpError(-1, "网络连接失败", undefined, error);
    }
}

// 创建 axios 实例
const request = axios.create({
    baseURL: getViteEnvString("VITE_API_BASE_URL") || "",
    timeout: 10000,
    headers: {
        "Content-Type": "application/json"
    }
});

// 请求拦截器
request.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = $Storage.local.get("token");
        if (token) {
            const headers = new AxiosHeaders(config.headers);
            headers.set("Authorization", `Bearer ${token}`);
            config.headers = headers;
        }
        return config;
    },
    (error: unknown) => {
        return Promise.reject(error);
    }
);

async function httpGet<TData>(url: string, data?: Record<string, unknown>, options?: HttpClientOptions): Promise<HttpApiResponse<TData>> {
    const axiosConfig = toAxiosRequestConfig(options);
    if (data === undefined) {
        return unwrapApiResponse<TData>(request.get<HttpApiResponse<TData>>(url, axiosConfig));
    }

    const cleanedData = maybeCleanRequestData(data, options);
    if (Object.keys(cleanedData).length === 0) {
        return unwrapApiResponse<TData>(request.get<HttpApiResponse<TData>>(url, axiosConfig));
    }

    const finalConfig = Object.assign({}, axiosConfig);
    (finalConfig as { params?: unknown }).params = cleanedData;

    return unwrapApiResponse<TData>(request.get<HttpApiResponse<TData>>(url, finalConfig));
}

async function httpPost<TData>(url: string, data?: Record<string, unknown> | FormData, options?: HttpClientOptions): Promise<HttpApiResponse<TData>> {
    const axiosConfig = toAxiosRequestConfig(options);
    if (data === undefined) {
        return unwrapApiResponse<TData>(request.post<HttpApiResponse<TData>>(url, undefined, axiosConfig));
    }

    if (data instanceof FormData) {
        return unwrapApiResponse<TData>(request.post<HttpApiResponse<TData>>(url, data, axiosConfig));
    }

    const cleanedData = maybeCleanRequestData(data, options);
    if (Object.keys(cleanedData).length === 0) {
        return unwrapApiResponse<TData>(request.post<HttpApiResponse<TData>>(url, undefined, axiosConfig));
    }

    return unwrapApiResponse<TData>(request.post<HttpApiResponse<TData>>(url, cleanedData, axiosConfig));
}

/**
 * 统一的 HTTP 请求对象（仅支持 GET 和 POST）
 * - 调用方式：$Http.get(url, data?, options?) / $Http.post(url, data?, options?)
 * - 重要行为：
 *   - 未传 data 时：不会自动发送 {}（GET 不注入 params，POST 不注入 body）
 *   - 传入 plain object 时：默认强制移除 null / undefined
 * - 可选参数清洗（第三参，且可与 axios config 混用）：
 *   - dropValues：全局丢弃值列表（仅对未配置 dropKeyValue 的 key 生效）
 *   - dropKeyValue：按 key 精确配置丢弃值列表（覆盖全局 dropValues）
 */
export const $Http = {
    get: httpGet,
    post: httpPost
};
