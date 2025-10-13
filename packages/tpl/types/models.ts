/**
 * 项目数据模型类型定义
 */

import type { BaseEntity } from 'befly/types';

/**
 * 用户模型
 */
export interface User extends BaseEntity {
    username: string;
    email: string;
    password: string;
    role: UserRole;
    avatar?: string;
    nickname?: string;
}

/**
 * 用户角色
 */
export type UserRole = 'admin' | 'user' | 'guest';

/**
 * 文章模型
 */
export interface Article extends BaseEntity {
    title: string;
    content: string;
    authorId: number;
    categoryId: number;
    tags: string[];
    summary?: string;
    coverImage?: string;
    viewCount: number;
    published: boolean;
}

/**
 * 产品模型
 */
export interface Product extends BaseEntity {
    name: string;
    price: number;
    stock: number;
    categoryId: number;
    description: string;
    images: string[];
    tags: string[];
}

/**
 * 订单模型
 */
export interface Order extends BaseEntity {
    orderNo: string;
    userId: number;
    productId: number;
    quantity: number;
    totalPrice: number;
    status: OrderStatus;
    address?: string;
}

/**
 * 订单状态
 */
export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled';
