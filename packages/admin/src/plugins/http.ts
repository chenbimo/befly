import axios, { AxiosHeaders, type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { MessagePlugin } from "tdesign-vue-next";

import { cleanParams } from "../utils/cleanParams";
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

export type HttpRequestConfig = AxiosRequestConfig & {
    cleanParams?: boolean | HttpCleanParamsOptions;
};

export type HttpClientOptions = (HttpRequestConfig & HttpCleanParamsOptions) | HttpCleanParamsOptions;

function toAxiosRequestConfig(options: HttpClientOptions | undefined): AxiosRequestConfig | undefined {
    if (!options) {
        return undefined;
    }

    const out = Object.assign({}, options) as Record<string, unknown>;
    delete out["cleanParams"];
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

function getCleanParamsOptions(options: HttpClientOptions | undefined): boolean | HttpCleanParamsOptions | undefined {
    if (!options) {
        return undefined;
    }

    // 兼容旧写法：{ cleanParams: true | { dropValues, dropKeyValue }, ...axiosConfig }
    if ("cleanParams" in options) {
        return options.cleanParams;
    }

    // 新写法：第三参直接传 { dropValues, dropKeyValue }
    if ("dropValues" in options || "dropKeyValue" in options) {
        return options as HttpCleanParamsOptions;
    }

    return undefined;
}

function maybeCleanRequestData(data: Record<string, unknown>, cleanOptions: boolean | HttpCleanParamsOptions | undefined): Record<string, unknown> {
    if (!cleanOptions) {
        return data;
    }

    if (!isPlainRecord(data)) {
        return data;
    }

    if (cleanOptions === true) {
        return cleanParams(data, []);
    }

    const dropValues = cleanOptions.dropValues;
    const dropKeyValue = cleanOptions.dropKeyValue;
    return cleanParams(data, dropValues, dropKeyValue);
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

        MessagePlugin.error("网络连接失败");
        throw new HttpError(-1, "网络连接失败", undefined, error);
    }
}

// 创建 axios 实例
const request = axios.create({
    baseURL: import.meta.env["VITE_API_BASE_URL"] || "",
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
    const inputData = data ?? {};
    const cleanOptions = getCleanParamsOptions(options);
    const cleanedData = maybeCleanRequestData(inputData, cleanOptions);

    const finalConfig = Object.assign({}, axiosConfig);
    (finalConfig as { params?: unknown }).params = cleanedData;

    return unwrapApiResponse<TData>(request.get<HttpApiResponse<TData>>(url, finalConfig));
}

async function httpPost<TData>(url: string, data?: Record<string, unknown>, options?: HttpClientOptions): Promise<HttpApiResponse<TData>> {
    const cleanOptions = getCleanParamsOptions(options);
    const axiosConfig = toAxiosRequestConfig(options);
    const inputData = data ?? {};
    const cleanedData = maybeCleanRequestData(inputData, cleanOptions);

    return unwrapApiResponse<TData>(request.post<HttpApiResponse<TData>>(url, cleanedData, axiosConfig));
}

/**
 * 统一的 HTTP 请求对象（仅支持 GET 和 POST）
 * - 调用方式：$Http.get(url, data?, options?) / $Http.post(url, data?, options?)
 * - 可选参数清洗：
 *   - 旧写法：通过 config.cleanParams 开启
 *   - 新写法：第三参直接传 { dropValues, dropKeyValue }
 */
export const $Http = {
    get: httpGet,
    post: httpPost
};
