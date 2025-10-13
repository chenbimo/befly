/**
 * API 请求/响应类型定义
 */

import type { PaginationParams, ListResponse } from 'befly/types';
import type { User, Article, Product, Order } from './models';

/**
 * 用户登录请求
 */
export interface LoginRequest {
    username: string;
    password: string;
}

/**
 * 用户登录响应
 */
export interface LoginResponse {
    token: string;
    user: Omit<User, 'password'>;
}

/**
 * 用户注册请求
 */
export interface RegisterRequest {
    username: string;
    email: string;
    password: string;
}

/**
 * 获取用户列表请求
 */
export interface GetUsersRequest extends PaginationParams {
    role?: string;
    keyword?: string;
}

/**
 * 获取用户列表响应
 */
export type GetUsersResponse = ListResponse<Omit<User, 'password'>>;

/**
 * 创建文章请求
 */
export interface CreateArticleRequest {
    title: string;
    content: string;
    categoryId: number;
    tags: string[];
    summary?: string;
    coverImage?: string;
}

/**
 * 获取文章列表请求
 */
export interface GetArticlesRequest extends PaginationParams {
    categoryId?: number;
    authorId?: number;
    keyword?: string;
    published?: boolean;
}

/**
 * 获取文章列表响应
 */
export type GetArticlesResponse = ListResponse<Article>;

/**
 * 创建产品请求
 */
export interface CreateProductRequest {
    name: string;
    price: number;
    stock: number;
    categoryId: number;
    description: string;
    images?: string[];
    tags?: string[];
}

/**
 * 获取产品列表请求
 */
export interface GetProductsRequest extends PaginationParams {
    categoryId?: number;
    minPrice?: number;
    maxPrice?: number;
    keyword?: string;
}

/**
 * 获取产品列表响应
 */
export type GetProductsResponse = ListResponse<Product>;

/**
 * 创建订单请求
 */
export interface CreateOrderRequest {
    productId: number;
    quantity: number;
    address?: string;
}

/**
 * 创建订单响应
 */
export interface CreateOrderResponse {
    orderId: number;
    orderNo: string;
    totalPrice: number;
}

/**
 * 获取订单列表请求
 */
export interface GetOrdersRequest extends PaginationParams {
    userId?: number;
    status?: string;
}

/**
 * 获取订单列表响应
 */
export type GetOrdersResponse = ListResponse<Order>;
