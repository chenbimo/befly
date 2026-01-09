import axios, { AxiosHeaders, type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { MessagePlugin } from "tdesign-vue-next";

import { cleanParams } from "../utils/cleanParams";
import { $Storage } from "./storage";

type ApiResponse<TData> = {
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

function toAxiosRequestConfig(config: HttpRequestConfig | undefined): AxiosRequestConfig | undefined {
    if (!config) {
        return undefined;
    }

    const out = Object.assign({}, config);
    delete (out as { cleanParams?: unknown }).cleanParams;
    return out;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    if (typeof value !== "object" || value === null) return false;
    if (Array.isArray(value)) return false;
    if (value instanceof FormData) return false;
    return true;
}

function maybeCleanRequestData(data: unknown, config: HttpRequestConfig | undefined): unknown {
    const cleanParamsConfig = config?.cleanParams;
    if (!cleanParamsConfig) {
        return data;
    }

    if (!isPlainRecord(data)) {
        return data;
    }

    if (cleanParamsConfig === true) {
        return cleanParams(data, []);
    }

    const dropValues = cleanParamsConfig.dropValues;
    const dropKeyValue = cleanParamsConfig.dropKeyValue;
    return cleanParams(data, dropValues, dropKeyValue);
}

type NormalizedHttpError = {
    code: number;
    msg: string;
    data?: unknown;
    error?: unknown;
};

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

function isNormalizedHttpError(value: unknown): value is NormalizedHttpError {
    return value instanceof HttpError;
}

async function unwrapApiResponse<TData>(promise: Promise<AxiosResponse<ApiResponse<TData>>>): Promise<ApiResponse<TData>> {
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

async function httpGet<TData>(url: string, data?: Record<string, unknown>, config?: HttpRequestConfig): Promise<ApiResponse<TData>> {
    const axiosConfig = toAxiosRequestConfig(config);
    const inputData = data ?? {};
    const cleanedData = maybeCleanRequestData(inputData, config);

    const finalConfig = Object.assign({}, axiosConfig);
    (finalConfig as { params?: unknown }).params = cleanedData;

    return unwrapApiResponse<TData>(request.get<ApiResponse<TData>>(url, finalConfig));
}

async function httpPost<TData>(url: string, data?: unknown, config?: HttpRequestConfig): Promise<ApiResponse<TData>> {
    const axiosConfig = toAxiosRequestConfig(config);
    const inputData = data ?? {};
    const cleanedData = maybeCleanRequestData(inputData, config);

    return unwrapApiResponse<TData>(request.post<ApiResponse<TData>>(url, cleanedData, axiosConfig));
}

/**
 * 统一的 HTTP 请求对象（仅支持 GET 和 POST）
 * - 调用方式：$Http.get(url, data?, config?) / $Http.post(url, data?, config?)
 * - 可选参数清洗：通过 config.cleanParams 开启
 */
export const $Http = {
    get: httpGet,
    post: httpPost
};
