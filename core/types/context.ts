/**
 * 请求上下文类
 * 提供统一的请求数据访问接口和类型安全
 */

/**
 * 标准请求上下文类
 */
export class RequestContext {
    /** 原始请求对象 */
    public readonly request: Request;

    /** 请求开始时间（毫秒） */
    public readonly startTime: number;

    /** 请求参数 (GET/POST 解析后的数据) */
    public params: Record<string, any> = {};

    /** 用户信息 (认证后填充) */
    public user: Record<string, any> = {};

    /** 自定义状态 (用于在中间件间传递数据) */
    public state: Record<string, any> = {};

    /** 响应数据 (由 handler 设置) */
    public response?: any;

    constructor(req: Request) {
        this.request = req;
        this.startTime = Date.now();
    }

    // ========== 便捷访问器 ==========

    /**
     * 获取请求方法
     */
    get method(): string {
        return this.request.method;
    }

    /**
     * 获取请求 URL
     */
    get url(): string {
        return this.request.url;
    }

    /**
     * 获取请求头对象
     */
    get headers(): Headers {
        return this.request.headers;
    }

    /**
     * 获取客户端 IP 地址
     */
    get ip(): string | null {
        return this.request.headers.get('x-forwarded-for') || this.request.headers.get('x-real-ip') || this.request.headers.get('cf-connecting-ip') || null;
    }

    /**
     * 获取 User-Agent
     */
    get userAgent(): string | null {
        return this.request.headers.get('user-agent');
    }

    /**
     * 获取 Content-Type
     */
    get contentType(): string | null {
        return this.request.headers.get('content-type');
    }

    // ========== 工具方法 ==========

    /**
     * 获取请求头
     * @param name - 请求头名称
     */
    header(name: string): string | null {
        return this.request.headers.get(name);
    }

    /**
     * 获取参数值
     * @param key - 参数键名
     */
    get(key: string): any {
        return this.params[key];
    }

    /**
     * 设置参数值
     * @param key - 参数键名
     * @param value - 参数值
     */
    set(key: string, value: any): void {
        this.params[key] = value;
    }

    /**
     * 检查参数是否存在
     * @param key - 参数键名
     */
    has(key: string): boolean {
        return key in this.params;
    }

    /**
     * 获取所有参数
     */
    all(): Record<string, any> {
        return { ...this.params };
    }

    /**
     * 计算请求耗时（毫秒）
     */
    getElapsedTime(): number {
        return Date.now() - this.startTime;
    }

    /**
     * 获取格式化的请求信息（用于日志）
     */
    getRequestInfo(): Record<string, any> {
        return {
            method: this.method,
            url: this.url,
            ip: this.ip,
            userAgent: this.userAgent,
            elapsedTime: this.getElapsedTime()
        };
    }

    /**
     * 设置响应数据
     * @param data - 响应数据
     */
    setResponse(data: any): void {
        this.response = data;
    }

    /**
     * 判断用户是否已登录
     */
    isAuthenticated(): boolean {
        return !!this.user.id;
    }

    /**
     * 获取用户 ID
     */
    getUserId(): number | null {
        return this.user.id || null;
    }

    /**
     * 获取用户角色
     */
    getUserRole(): string | null {
        return this.user.role || this.user.role_type || null;
    }
}
