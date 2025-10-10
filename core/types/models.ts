/**
 * 数据模型类型定义
 *
 * 这个文件定义了常用的数据模型类型
 */

/**
 * 基础实体接口（所有表共有的字段）
 */
export interface BaseEntity {
    /** 主键 ID */
    id: number;
    /** 创建时间（时间戳） */
    createdAt: number;
    /** 更新时间（时间戳） */
    updatedAt: number;
    /** 删除时间（时间戳，null 表示未删除） */
    deletedAt: number | null;
    /** 状态（0=正常，1=禁用） */
    state: number;
}

/**
 * 用户角色类型
 */
export type UserRole = 'admin' | 'user' | 'guest' | 'editor' | 'viewer';

/**
 * 用户模型
 */
export interface User extends BaseEntity {
    /** 用户名 */
    username: string;
    /** 邮箱 */
    email: string;
    /** 密码（哈希后） */
    password: string;
    /** 角色 */
    role: UserRole;
    /** 手机号 */
    phone?: string;
    /** 头像 URL */
    avatar?: string;
    /** 昵称 */
    nickname?: string;
    /** 个人简介 */
    bio?: string;
}

/**
 * 产品分类
 */
export interface Category extends BaseEntity {
    /** 分类名称 */
    name: string;
    /** 父分类 ID */
    parentId: number | null;
    /** 排序 */
    sort: number;
    /** 描述 */
    description?: string;
}

/**
 * 产品模型
 */
export interface Product extends BaseEntity {
    /** 产品名称 */
    name: string;
    /** 价格（单位：分） */
    price: number;
    /** 库存 */
    stock: number;
    /** 分类 ID */
    categoryId: number;
    /** 标签 */
    tags: string[];
    /** 描述 */
    description: string;
    /** 图片 URL 列表 */
    images?: string[];
    /** SKU */
    sku?: string;
    /** 原价 */
    originalPrice?: number;
}

/**
 * 订单状态
 */
export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled' | 'refunded';

/**
 * 订单模型
 */
export interface Order extends BaseEntity {
    /** 订单号 */
    orderNo: string;
    /** 用户 ID */
    userId: number;
    /** 产品 ID */
    productId: number;
    /** 数量 */
    quantity: number;
    /** 总价 */
    totalPrice: number;
    /** 状态 */
    status: OrderStatus;
    /** 收货地址 */
    address?: string;
    /** 收货人 */
    recipient?: string;
    /** 联系电话 */
    phone?: string;
    /** 备注 */
    remark?: string;
}

/**
 * 文章模型
 */
export interface Article extends BaseEntity {
    /** 标题 */
    title: string;
    /** 内容 */
    content: string;
    /** 作者 ID */
    authorId: number;
    /** 分类 ID */
    categoryId: number;
    /** 标签 */
    tags: string[];
    /** 摘要 */
    summary?: string;
    /** 封面图 */
    coverImage?: string;
    /** 浏览次数 */
    viewCount: number;
    /** 点赞次数 */
    likeCount: number;
    /** 是否发布 */
    published: boolean;
}

/**
 * 评论模型
 */
export interface Comment extends BaseEntity {
    /** 评论内容 */
    content: string;
    /** 用户 ID */
    userId: number;
    /** 关联 ID（文章、产品等） */
    targetId: number;
    /** 关联类型 */
    targetType: 'article' | 'product' | 'order';
    /** 父评论 ID */
    parentId: number | null;
    /** 点赞次数 */
    likeCount: number;
}

/**
 * 文件模型
 */
export interface File extends BaseEntity {
    /** 文件名 */
    filename: string;
    /** 原始文件名 */
    originalName: string;
    /** 文件路径 */
    path: string;
    /** 文件大小（字节） */
    size: number;
    /** MIME 类型 */
    mimeType: string;
    /** 文件哈希 */
    hash: string;
    /** 上传者 ID */
    uploaderId: number;
    /** 文件类型 */
    type: 'image' | 'video' | 'audio' | 'document' | 'other';
}

/**
 * 配置模型
 */
export interface Config extends BaseEntity {
    /** 配置键 */
    key: string;
    /** 配置值 */
    value: string;
    /** 配置类型 */
    type: 'string' | 'number' | 'boolean' | 'json';
    /** 描述 */
    description?: string;
    /** 分组 */
    group?: string;
}

/**
 * 日志模型
 */
export interface Log extends BaseEntity {
    /** 日志级别 */
    level: 'info' | 'warn' | 'error' | 'debug';
    /** 日志消息 */
    message: string;
    /** 用户 ID */
    userId?: number;
    /** IP 地址 */
    ip?: string;
    /** 用户代理 */
    userAgent?: string;
    /** 额外数据 */
    metadata?: Record<string, any>;
}

/**
 * 通知模型
 */
export interface Notification extends BaseEntity {
    /** 标题 */
    title: string;
    /** 内容 */
    content: string;
    /** 接收者 ID */
    receiverId: number;
    /** 类型 */
    type: 'system' | 'order' | 'comment' | 'like' | 'follow';
    /** 是否已读 */
    read: boolean;
    /** 关联 ID */
    targetId?: number;
    /** 关联类型 */
    targetType?: string;
}

/**
 * 权限模型
 */
export interface Permission extends BaseEntity {
    /** 权限名称 */
    name: string;
    /** 权限标识 */
    code: string;
    /** 描述 */
    description?: string;
    /** 资源类型 */
    resource: string;
    /** 操作类型 */
    action: 'create' | 'read' | 'update' | 'delete' | 'execute';
}

/**
 * 角色模型
 */
export interface Role extends BaseEntity {
    /** 角色名称 */
    name: string;
    /** 角色标识 */
    code: string;
    /** 描述 */
    description?: string;
    /** 权限 ID 列表 */
    permissions: number[];
}
