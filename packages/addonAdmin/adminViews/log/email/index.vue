<template>
    <div class="page-email page-table">
        <div class="main-tool">
            <div class="left">
                <TButton theme="primary" @click="$Method.openSendDialog">
                    <template #icon>
                        <ILucideSend />
                    </template>
                    发送邮件
                </TButton>
                <TButton variant="outline" @click="$Method.onVerify">
                    <template #icon>
                        <ILucideCheckCircle />
                    </template>
                    验证配置
                </TButton>
            </div>
            <div class="right">
                <TButton shape="circle" @click="$Method.handleRefresh">
                    <template #icon>
                        <ILucideRotateCw />
                    </template>
                </TButton>
            </div>
        </div>

        <div class="main-content">
            <div class="main-table">
                <TTable :data="$Data.tableData" :columns="$Data.columns" :loading="$Data.loading" :active-row-keys="$Data.activeRowKeys" row-key="id" height="100%" active-row-type="single" @active-change="$Method.onActiveChange">
                    <template #sendResult="{ row }">
                        <TTag v-if="row.sendResult === 1" shape="round" theme="success" variant="light-outline">成功</TTag>
                        <TTag v-else shape="round" theme="danger" variant="light-outline">失败</TTag>
                    </template>
                    <template #sendTime="{ row }">
                        {{ $Method.formatTime(row.sendTime) }}
                    </template>
                </TTable>
            </div>

            <div class="main-detail">
                <DetailPanel :data="$Data.currentRow" :fields="$Data.detailFields">
                    <template #sendResult="{ value }">
                        <TTag v-if="value === 1" shape="round" theme="success" variant="light-outline">成功</TTag>
                        <TTag v-else shape="round" theme="danger" variant="light-outline">失败</TTag>
                    </template>
                    <template #sendTime="{ value }">
                        {{ $Method.formatTime(value) }}
                    </template>
                    <template #content="{ value }">
                        <div class="email-content" v-html="value"></div>
                    </template>
                </DetailPanel>
            </div>
        </div>

        <div class="main-page">
            <TPagination :current-page="$Data.pagerConfig.currentPage" :page-size="$Data.pagerConfig.limit" :total="$Data.pagerConfig.total" @current-change="$Method.onPageChange" @page-size-change="$Method.handleSizeChange" />
        </div>

        <!-- 发送邮件弹框 -->
        <TDialog v-model:visible="$Data.sendDialogVisible" header="发送邮件" :footer="false" width="600px">
            <TForm ref="sendFormRef" :data="$Data.sendForm" :rules="$Data.sendRules" label-width="80px">
                <TFormItem label="收件人" name="to">
                    <TInput v-model="$Data.sendForm.to" placeholder="请输入收件人邮箱" />
                </TFormItem>
                <TFormItem label="抄送" name="cc">
                    <TInput v-model="$Data.sendForm.cc" placeholder="多个邮箱用逗号分隔（可选）" />
                </TFormItem>
                <TFormItem label="主题" name="subject">
                    <TInput v-model="$Data.sendForm.subject" placeholder="请输入邮件主题" />
                </TFormItem>
                <TFormItem label="内容" name="content">
                    <TTextarea v-model="$Data.sendForm.content" placeholder="请输入邮件内容（支持HTML）" :autosize="{ minRows: 6, maxRows: 12 }" />
                </TFormItem>
                <TFormItem>
                    <TSpace>
                        <TButton theme="primary" :loading="$Data.sending" @click="$Method.onSend">发送</TButton>
                        <TButton variant="outline" @click="$Data.sendDialogVisible = false">取消</TButton>
                    </TSpace>
                </TFormItem>
            </TForm>
        </TDialog>
    </div>
</template>

<script setup>
import { Button as TButton, Table as TTable, Tag as TTag, Pagination as TPagination, Dialog as TDialog, Form as TForm, FormItem as TFormItem, Input as TInput, Textarea as TTextarea, Space as TSpace, MessagePlugin } from "tdesign-vue-next";
import ILucideRotateCw from "~icons/lucide/rotate-cw";
import ILucideSend from "~icons/lucide/send";
import ILucideCheckCircle from "~icons/lucide/check-circle";
import DetailPanel from "@/components/DetailPanel.vue";
import { $Http } from "@/plugins/http";
import { withDefaultColumns } from "@/utils/withDefaultColumns";

definePage({
    meta: {
        title: "邮件日志",
        order: 2
    }
});

const sendFormRef = $ref(null);

// 响应式数据
const $Data = $ref({
    tableData: [],
    loading: false,
    columns: withDefaultColumns([
        { colKey: "username", title: "发送人", fixed: "left" },
        { colKey: "toEmail", title: "收件人" },
        { colKey: "subject", title: "主题" },
        { colKey: "sendTime", title: "发送时间" },
        { colKey: "sendResult", title: "发送结果" }
    ]),
    detailFields: [
        { colKey: "username", title: "发送人账号" },
        { colKey: "nickname", title: "发送人昵称" },
        { colKey: "toEmail", title: "收件人" },
        { colKey: "ccEmail", title: "抄送" },
        { colKey: "bccEmail", title: "密送" },
        { colKey: "subject", title: "主题" },
        { colKey: "content", title: "内容" },
        { colKey: "sendTime", title: "发送时间" },
        { colKey: "sendResult", title: "发送结果" },
        { colKey: "messageId", title: "消息ID" },
        { colKey: "failReason", title: "失败原因" }
    ],
    pagerConfig: {
        currentPage: 1,
        limit: 30,
        total: 0
    },
    currentRow: null,
    activeRowKeys: [],
    sendDialogVisible: false,
    sending: false,
    sendForm: {
        to: "",
        cc: "",
        subject: "",
        content: ""
    },
    sendRules: {
        to: [{ required: true, message: "请输入收件人邮箱", trigger: "blur" }],
        subject: [{ required: true, message: "请输入邮件主题", trigger: "blur" }],
        content: [{ required: true, message: "请输入邮件内容", trigger: "blur" }]
    }
});

// 方法
const $Method = {
    async initData() {
        await $Method.apiEmailLogList();
    },

    // 加载邮件日志列表
    async apiEmailLogList() {
        $Data.loading = true;
        try {
            const res = await $Http("/addon/admin/email/logList", {
                page: $Data.pagerConfig.currentPage,
                limit: $Data.pagerConfig.limit
            });
            $Data.tableData = res.data.lists || [];
            $Data.pagerConfig.total = res.data.total || 0;

            if ($Data.tableData.length > 0) {
                $Data.currentRow = $Data.tableData[0];
                $Data.activeRowKeys = [$Data.tableData[0].id];
            } else {
                $Data.currentRow = null;
                $Data.activeRowKeys = [];
            }
        } catch (error) {
            MessagePlugin.error("加载数据失败");
        } finally {
            $Data.loading = false;
        }
    },

    // 打开发送弹框
    openSendDialog() {
        $Data.sendForm = {
            to: "",
            cc: "",
            subject: "",
            content: ""
        };
        $Data.sendDialogVisible = true;
    },

    // 发送邮件
    async onSend() {
        const valid = await sendFormRef?.validate();
        if (valid !== true) return;

        $Data.sending = true;
        try {
            const res = await $Http("/addon/admin/email/send", {
                to: $Data.sendForm.to,
                subject: $Data.sendForm.subject,
                content: $Data.sendForm.content,
                cc: $Data.sendForm.cc || undefined,
                isHtml: true
            });

            if (res.code === 0) {
                MessagePlugin.success("发送成功");
                $Data.sendDialogVisible = false;
                $Method.apiEmailLogList();
            } else {
                MessagePlugin.error(res.msg || "发送失败");
            }
        } catch (error) {
            MessagePlugin.error("发送失败");
        } finally {
            $Data.sending = false;
        }
    },

    // 验证配置
    async onVerify() {
        try {
            const res = await $Http("/addon/admin/email/verify");
            if (res.code === 0) {
                MessagePlugin.success("邮件服务配置正常");
            } else {
                MessagePlugin.error(res.msg || "配置异常");
            }
        } catch (error) {
            MessagePlugin.error("验证失败");
        }
    },

    // 刷新
    handleRefresh() {
        $Method.apiEmailLogList();
    },

    // 分页改变
    onPageChange(currentPage) {
        $Data.pagerConfig.currentPage = currentPage;
        $Method.apiEmailLogList();
    },

    // 每页条数改变
    handleSizeChange(pageSize) {
        $Data.pagerConfig.limit = pageSize;
        $Data.pagerConfig.currentPage = 1;
        $Method.apiEmailLogList();
    },

    // 高亮行变化
    onActiveChange(value, context) {
        if (value.length === 0 && $Data.activeRowKeys.length > 0) {
            return;
        }
        $Data.activeRowKeys = value;
        if (context.activeRowList && context.activeRowList.length > 0) {
            $Data.currentRow = context.activeRowList[0].row;
        }
    },

    // 格式化时间
    formatTime(timestamp) {
        if (!timestamp) return "-";
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const seconds = String(date.getSeconds()).padStart(2, "0");
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
};

$Method.initData();
</script>

<style scoped lang="scss">
.email-content {
    max-height: 300px;
    overflow-y: auto;
    padding: 8px;
    background: #f5f5f5;
    border-radius: 4px;
    font-size: 13px;
    line-height: 1.6;
}
</style>
