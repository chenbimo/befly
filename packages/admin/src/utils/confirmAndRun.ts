/**
 * DialogPlugin.confirm 辅助封装（Admin 前端专用）
 * - 统一处理 destroy，避免 DOM 泄漏
 * - 使用 setConfirmLoading 防止重复点击
 */

import { DialogPlugin, MessagePlugin } from "tdesign-vue-next";

export type ConfirmDialogStatus = "warning" | "danger" | "info" | "success" | "error";

export interface ConfirmAndRunOptions {
  header: string;
  body: string;
  status?: ConfirmDialogStatus;
  onConfirm: () => Promise<void>;

  /**
   * 默认 true：确认成功后自动关闭
   */
  closeOnSuccess?: boolean;

  /**
   * 默认 true：确认失败后自动关闭
   * 设置为 false 可实现“失败不关闭，允许用户重试”
   */
  closeOnError?: boolean;

  /** 确认回调抛错时触发（不会影响 confirmAndRun 自身的 loading / close 控制） */
  onError?: (error: unknown) => Promise<void> | void;
}

export function confirmAndRun(options: ConfirmAndRunOptions): void {
  type DialogConfirmInstance = ReturnType<typeof DialogPlugin.confirm>;

  let dialog: DialogConfirmInstance | null = null;
  let destroyed = false;

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    if (dialog && typeof dialog.destroy === "function") {
      dialog.destroy();
    }
  };

  dialog = DialogPlugin.confirm({
    header: options.header,
    body: options.body,
    status: options.status,
    onConfirm: async () => {
      if (dialog && typeof dialog.setConfirmLoading === "function") {
        dialog.setConfirmLoading(true);
      }

      let success = false;

      try {
        await options.onConfirm();
        success = true;
      } catch (error) {
        success = false;
        if (options.onError) {
          await options.onError(error);
        }
      } finally {
        if (dialog && typeof dialog.setConfirmLoading === "function") {
          dialog.setConfirmLoading(false);
        }

        if (success) {
          if (options.closeOnSuccess !== false) {
            destroy();
          }
        } else {
          if (options.closeOnError !== false) {
            destroy();
          }
        }
      }
    },
    onClose: () => {
      destroy();
    },
  });
}

export interface ConfirmDeleteAndRunOptions {
  /** 删除对象的展示名称，例如：角色“管理员” */
  displayName: string;

  /** 覆盖提示文案（不传则使用默认：确定要删除${displayName}吗？） */
  body?: string;

  /** 执行删除请求，返回标准 code/msg */
  request: () => Promise<{ code: number; msg?: string }>;

  /** 删除成功后需要刷新列表等 */
  onSuccess?: () => Promise<void> | void;

  header?: string;
  status?: ConfirmDialogStatus;
  successMessage?: string;
  errorMessage?: string;

  /** 默认 false：失败不关闭，可继续点“确定”重试 */
  closeOnError?: boolean;
}

export function confirmDeleteAndRun(options: ConfirmDeleteAndRunOptions): void {
  const header = options.header || "确认删除";
  const status = options.status || "warning";
  const successMessage = options.successMessage || "删除成功";
  const errorMessage = options.errorMessage || "删除失败";
  const body = options.body || `确定要删除${options.displayName}吗？`;

  confirmAndRun({
    header: header,
    body: body,
    status: status,
    closeOnSuccess: true,
    closeOnError: options.closeOnError === true ? true : false,
    onConfirm: async () => {
      const res = await options.request();
      if (res && res.code === 0) {
        MessagePlugin.success(successMessage);
        if (options.onSuccess) {
          await options.onSuccess();
        }
        return;
      }

      const msg = res && res.msg ? res.msg : errorMessage;
      MessagePlugin.error(msg);

      // 抛出错误以触发 confirmAndRun 的失败分支（用于 closeOnError 控制）
      throw new Error(msg);
    },
  });
}
