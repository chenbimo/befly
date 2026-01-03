<template>
    <div class="page-login-log page-table">
        <div class="main-tool">
            <div class="left"></div>
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
                    <template #loginResult="{ row }">
                        <TTag v-if="row.loginResult === 1" shape="round" theme="success" variant="light-outline">成功</TTag>
                        <TTag v-else shape="round" theme="danger" variant="light-outline">失败</TTag>
                    </template>
                    <template #loginTime="{ row }">
                        {{ $Method.formatTime(row.loginTime) }}
                    </template>
                    <template #deviceType="{ row }">
                        <TTag shape="round" variant="light-outline">{{ row.deviceType || "desktop" }}</TTag>
                    </template>
                </TTable>
            </div>

            <div class="main-detail">
                <DetailPanel :data="$Data.currentRow" :fields="$Data.detailFields">
                    <template #loginResult="{ value }">
                        <TTag v-if="value === 1" shape="round" theme="success" variant="light-outline">成功</TTag>
                        <TTag v-else shape="round" theme="danger" variant="light-outline">失败</TTag>
                    </template>
                    <template #loginTime="{ value }">
                        {{ $Method.formatTime(value) }}
                    </template>
                    <template #deviceType="{ value }">
                        <TTag shape="round" variant="light-outline">{{ value || "desktop" }}</TTag>
                    </template>
                </DetailPanel>
            </div>
        </div>

        <div class="main-page">
            <TPagination :current-page="$Data.pagerConfig.currentPage" :page-size="$Data.pagerConfig.limit" :total="$Data.pagerConfig.total" @current-change="$Method.onPageChange" @page-size-change="$Method.handleSizeChange" />
        </div>
    </div>
</template>

<script setup>
import { Button as TButton, Table as TTable, Tag as TTag, Pagination as TPagination, MessagePlugin } from "tdesign-vue-next";
import ILucideRotateCw from "~icons/lucide/rotate-cw";
import DetailPanel from "@/components/DetailPanel.vue";
import { $Http } from "@/plugins/http";
import { withDefaultColumns } from "befly-shared/utils/withDefaultColumns";

definePage({
    meta: {
        title: "登录日志",
        order: 1
    }
});

// 响应式数据
const $Data = $ref({
    tableData: [],
    loading: false,
    columns: withDefaultColumns([
        { colKey: "username", title: "用户名", fixed: "left" },
        { colKey: "ip", title: "登录IP" },
        { colKey: "browserName", title: "浏览器" },
        { colKey: "osName", title: "操作系统" },
        { colKey: "deviceType", title: "设备类型" },
        { colKey: "loginTime", title: "登录时间" },
        { colKey: "loginResult", title: "登录结果" }
    ]),
    // 详情面板显示更多字段
    detailFields: [
        { colKey: "username", title: "用户名" },
        { colKey: "nickname", title: "昵称" },
        { colKey: "ip", title: "登录IP" },
        { colKey: "browserName", title: "浏览器" },
        { colKey: "browserVersion", title: "浏览器版本" },
        { colKey: "osName", title: "操作系统" },
        { colKey: "osVersion", title: "系统版本" },
        { colKey: "deviceType", title: "设备类型" },
        { colKey: "deviceVendor", title: "设备厂商" },
        { colKey: "deviceModel", title: "设备型号" },
        { colKey: "engineName", title: "渲染引擎" },
        { colKey: "cpuArchitecture", title: "CPU架构" },
        { colKey: "loginTime", title: "登录时间" },
        { colKey: "loginResult", title: "登录结果" },
        { colKey: "failReason", title: "失败原因" }
    ],
    pagerConfig: {
        currentPage: 1,
        limit: 30,
        total: 0
    },
    currentRow: null,
    activeRowKeys: []
});

// 方法
const $Method = {
    async initData() {
        await $Method.apiLoginLogList();
    },

    // 加载登录日志列表
    async apiLoginLogList() {
        $Data.loading = true;
        try {
            const res = await $Http("/addon/admin/loginLog/list", {
                page: $Data.pagerConfig.currentPage,
                limit: $Data.pagerConfig.limit
            });
            $Data.tableData = res.data.lists || [];
            $Data.pagerConfig.total = res.data.total || 0;

            // 自动高亮第一行
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

    // 刷新
    handleRefresh() {
        $Method.apiLoginLogList();
    },

    // 分页改变
    onPageChange(currentPage) {
        $Data.pagerConfig.currentPage = currentPage;
        $Method.apiLoginLogList();
    },

    // 每页条数改变
    handleSizeChange(pageSize) {
        $Data.pagerConfig.limit = pageSize;
        $Data.pagerConfig.currentPage = 1;
        $Method.apiLoginLogList();
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
// 样式继承自全局 page-table
</style>
