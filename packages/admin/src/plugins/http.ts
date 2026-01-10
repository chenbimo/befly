import axios, { AxiosHeaders, type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { cleanParams } from "befly-shared/utils/cleanParams";

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

export type HttpGetData = Record<string, unknown>;
export type HttpPostData = Record<string, unknown> | FormData;

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
    baseURL: (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE_URL || "",
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

async function httpGet<TData>(url: string, data?: HttpGetData, options?: HttpClientOptions): Promise<HttpApiResponse<TData>> {
    const axiosConfig = toAxiosRequestConfig(options);
    const inputData = data ?? {};
    const cleanedData = maybeCleanRequestData(inputData, options);

    // 规则：GET 必须传 params；为空也传空对象
    const finalConfig = Object.assign({}, axiosConfig);
    (finalConfig as { params?: unknown }).params = cleanedData;

    return unwrapApiResponse<TData>(request.get<HttpApiResponse<TData>>(url, finalConfig));
}

async function httpPost<TData>(url: string, data?: HttpPostData, options?: HttpClientOptions): Promise<HttpApiResponse<TData>> {
    const axiosConfig = toAxiosRequestConfig(options);
    if (data === undefined) {
        // 规则：POST 必须传 body；为空也传空对象
        return unwrapApiResponse<TData>(request.post<HttpApiResponse<TData>>(url, {}, axiosConfig));
    }

    if (data instanceof FormData) {
        return unwrapApiResponse<TData>(request.post<HttpApiResponse<TData>>(url, data, axiosConfig));
    }

    const cleanedData = maybeCleanRequestData(data, options);
    if (Object.keys(cleanedData).length === 0) {
        // 规则：POST 必须传 body；清洗为空则传空对象
        return unwrapApiResponse<TData>(request.post<HttpApiResponse<TData>>(url, {}, axiosConfig));
    }

    return unwrapApiResponse<TData>(request.post<HttpApiResponse<TData>>(url, cleanedData, axiosConfig));
}

/**
 * 统一的 HTTP 请求对象（仅支持 GET 和 POST）
 * - 调用方式：$Http.get(url, data?, options?) / $Http.post(url, data?, options?)
 * - 重要行为：
 *   - 未传 data / 清洗为空时：仍会发送空对象（GET: params={}, POST: body={}）
 *     - 原因：部分后端接口会基于“参数结构存在”触发默认逻辑/签名校验/中间件约束；
 *       因此这里不做“省略空对象”的优化。
 *   - 传入 plain object 时：默认强制移除 null / undefined
 * - 可选参数清洗（第三参，且可与 axios config 混用）：
 *   - dropValues：全局丢弃值列表（仅对未配置 dropKeyValue 的 key 生效）
 *   - dropKeyValue：按 key 精确配置丢弃值列表（覆盖全局 dropValues）
 *
 *   例子：保留 page=0，但丢弃 keyword=""，并且其它字段应用全局 dropValues
 *   - dropValues: [0, ""]
 *   - dropKeyValue: { page: [], keyword: [""] }
 */
export const $Http = {
    get: httpGet,
    post: httpPost
};
