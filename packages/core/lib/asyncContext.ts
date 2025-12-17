/**
 * AsyncLocalStorage 请求级上下文
 *
 * 目标：
 * - 给 Logger/慢查询日志提供 requestId/route/userId 等元信息
 * - 避免在深层工具函数中层层传参
 */

import { AsyncLocalStorage } from "node:async_hooks";

export type RequestMeta = {
  requestId: string;
  method: string;
  route: string;
  ip: string;
  userId?: string | number | null;
  roleCode?: string | null;
  nickname?: string | null;
  roleType?: string | null;
  now: number;
};

const storage = new AsyncLocalStorage<RequestMeta>();

export function withCtx<T>(meta: RequestMeta, fn: () => T): T {
  return storage.run(meta, fn);
}

export function getCtx(): RequestMeta | null {
  const store = storage.getStore();
  if (!store) return null;
  return store;
}

export function setCtxUser(
  userId: string | number | null | undefined,
  roleCode?: string | null | undefined,
  nickname?: string | null | undefined,
  roleType?: string | null | undefined,
): void {
  const store = storage.getStore();
  if (!store) return;

  store.userId = userId;
  store.roleCode = roleCode;
  store.nickname = nickname;
  store.roleType = roleType;
}
