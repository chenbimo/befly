<template>
    <div class="page-api page-table">
        <div class="main-tool">
            <div class="left">
                <TInput v-model="$Data.searchKeyword" placeholder="搜索接口名称或路径" clearable style="width: 300px" @enter="$Method.handleSearch" @clear="$Method.handleSearch">
                    <template #suffix-icon>
                        <ILucideSearch />
                    </template>
                </TInput>
                <span style="margin-left: 16px; color: var(--text-secondary); font-size: 13px">共 {{ $Data.allData.length }} 个接口</span>
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
                <TTable :data="$Data.tableData" :columns="$Data.columns" :loading="$Data.loading" :active-row-keys="$Data.activeRowKeys" row-key="id" height="calc(100vh - var(--search-height) - var(--layout-gap) * 2)" active-row-type="single" @active-change="$Method.onActiveChange">
                    <template #method="{ row }">
                        <TTag v-if="row.method === 'GET'" shape="round" theme="success" variant="light-outline">GET</TTag>
                        <TTag v-else-if="row.method === 'POST'" shape="round" theme="primary" variant="light-outline">POST</TTag>
                        <TTag v-else-if="row.method === 'PUT'" shape="round" theme="warning" variant="light-outline">PUT</TTag>
                        <TTag v-else-if="row.method === 'DELETE'" shape="round" theme="danger" variant="light-outline">DELETE</TTag>
                        <TTag v-else shape="round" variant="light-outline">{{ row.method }}</TTag>
                    </template>
                    <template #auth="{ row }">
                        <TTag v-if="row.auth === 0" shape="round" theme="success" variant="light-outline">免登录</TTag>
                        <TTag v-else shape="round" theme="warning" variant="light-outline">需登录</TTag>
                    </template>
                    <template #addonName="{ row }">
                        <TTag v-if="row.addonName" shape="round" variant="light-outline">{{ row.addonTitle || row.addonName }}</TTag>
                        <span v-else>项目</span>
                    </template>
                </TTable>
            </div>

            <div class="main-detail">
                <DetailPanel :data="$Data.currentRow" :fields="$Data.columns">
                    <template #method="{ value }">
                        <TTag v-if="value === 'GET'" shape="round" theme="success" variant="light-outline">GET</TTag>
                        <TTag v-else-if="value === 'POST'" shape="round" theme="primary" variant="light-outline">POST</TTag>
                        <TTag v-else-if="value === 'PUT'" shape="round" theme="warning" variant="light-outline">PUT</TTag>
                        <TTag v-else-if="value === 'DELETE'" shape="round" theme="danger" variant="light-outline">DELETE</TTag>
                        <TTag v-else shape="round" variant="light-outline">{{ value }}</TTag>
                    </template>
                    <template #auth="{ value }">
                        <TTag v-if="value === 0" shape="round" theme="success" variant="light-outline">免登录</TTag>
                        <TTag v-else shape="round" theme="warning" variant="light-outline">需登录</TTag>
                    </template>
                </DetailPanel>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Button as TButton, Table as TTable, Tag as TTag, Input as TInput, MessagePlugin } from "tdesign-vue-next";
import ILucideRotateCw from "~icons/lucide/rotate-cw";
import ILucideSearch from "~icons/lucide/search";
import DetailPanel from "@/components/DetailPanel.vue";
import { $Http } from "@/plugins/http";
import { withDefaultColumns } from "../../../utils/withDefaultColumns";

// 响应式数据
const $Data = $ref({
    tableData: [],
    allData: [],
    loading: false,
    searchKeyword: "",
    columns: withDefaultColumns([
        { colKey: "name", title: "接口名称" },
        { colKey: "auth", title: "登录" },
        { colKey: "routePath", title: "接口路径" },
        { colKey: "method", title: "请求方法" },
        { colKey: "addonName", title: "所属组件" }
    ]),
    currentRow: null,
    activeRowKeys: []
});

// 方法
const $Method = {
    async initData() {
        await $Method.loadApiAll();
    },

    // 加载全部接口
    async loadApiAll() {
        $Data.loading = true;
        try {
            const res = await $Http("/addon/admin/api/all");
            const list = res.data?.lists || [];
            $Data.allData = list;
            $Data.tableData = list;

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
        $Method.loadApiAll();
    },

    // 搜索
    handleSearch() {
        if (!$Data.searchKeyword) {
            $Data.tableData = $Data.allData;
            return;
        }
        const keyword = $Data.searchKeyword.toLowerCase();
        $Data.tableData = $Data.allData.filter((item) => item.name?.toLowerCase().includes(keyword) || item.routePath?.toLowerCase().includes(keyword));
    },

    // 高亮行变化
    onActiveChange(value, context) {
        // 禁止取消高亮：如果新值为空，保持当前选中
        if (value.length === 0 && $Data.activeRowKeys.length > 0) {
            return;
        }
        $Data.activeRowKeys = value;
        // 更新当前高亮的行数据
        if (context.activeRowList && context.activeRowList.length > 0) {
            $Data.currentRow = context.activeRowList[0].row;
        }
    }
};

$Method.initData();
</script>

<style scoped lang="scss">
// 样式继承自全局 page-table
</style>
