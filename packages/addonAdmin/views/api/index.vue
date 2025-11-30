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
                <TTable v-bind="withTableProps()" :data="$Data.tableData" :columns="$Data.columns" :loading="$Data.loading" :selected-row-keys="$Data.selectedRowKeys" :active-row-keys="$Data.activeRowKeys" @select-change="$Method.onSelectChange" @active-change="$Method.onActiveChange">
                    <template #method="{ row }">
                        <TTag v-if="row.method === 'GET'" shape="round" theme="success" variant="light-outline">GET</TTag>
                        <TTag v-else-if="row.method === 'POST'" shape="round" theme="primary" variant="light-outline">POST</TTag>
                        <TTag v-else-if="row.method === 'PUT'" shape="round" theme="warning" variant="light-outline">PUT</TTag>
                        <TTag v-else-if="row.method === 'DELETE'" shape="round" theme="danger" variant="light-outline">DELETE</TTag>
                        <TTag v-else shape="round" variant="light-outline">{{ row.method }}</TTag>
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
                </DetailPanel>
            </div>
        </div>
    </div>
</template>

<script setup>
import { Button as TButton, Table as TTable, Tag as TTag, Input as TInput, MessagePlugin } from 'tdesign-vue-next';
import ILucideRotateCw from '~icons/lucide/rotate-cw';
import ILucideSearch from '~icons/lucide/search';
import { $Http } from '@/plugins/http';
import { withDefaultColumns, withTableProps } from '@/utils';
import DetailPanel from '@/components/DetailPanel.vue';

// 响应式数据
const $Data = $ref({
    tableData: [],
    allData: [],
    loading: false,
    searchKeyword: '',
    columns: withDefaultColumns([
        {
            colKey: 'row-select',
            type: 'single',
            width: 50,
            fixed: 'left',
            checkProps: { allowUncheck: true },
            ellipsis: false
        },
        { colKey: 'name', title: '接口名称', width: 200, fixed: 'left' },
        { colKey: 'id', title: '序号', width: 80, align: 'center' },
        { colKey: 'path', title: '接口路径', width: 350 },
        { colKey: 'method', title: '请求方法', width: 100, align: 'center', ellipsis: false },
        { colKey: 'addonName', title: '所属组件', width: 120, ellipsis: false }
    ]),
    currentRow: null,
    selectedRowKeys: [],
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
            const res = await $Http('/addon/admin/api/all');
            const list = res.data?.lists || [];
            $Data.allData = list;
            $Data.tableData = list;

            // 自动选中并高亮第一行
            if ($Data.tableData.length > 0) {
                $Data.currentRow = $Data.tableData[0];
                $Data.selectedRowKeys = [$Data.tableData[0].id];
                $Data.activeRowKeys = [$Data.tableData[0].id];
            } else {
                $Data.currentRow = null;
                $Data.selectedRowKeys = [];
                $Data.activeRowKeys = [];
            }
        } catch (error) {
            console.error('加载接口列表失败:', error);
            MessagePlugin.error('加载数据失败');
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
        $Data.tableData = $Data.allData.filter((item) => item.name?.toLowerCase().includes(keyword) || item.path?.toLowerCase().includes(keyword));
    },

    // 单选变化
    onSelectChange(value, { selectedRowData }) {
        $Data.selectedRowKeys = value;
        $Data.activeRowKeys = value;
        if (selectedRowData && selectedRowData.length > 0) {
            $Data.currentRow = selectedRowData[0];
        } else if ($Data.tableData.length > 0) {
            $Data.currentRow = $Data.tableData[0];
            $Data.selectedRowKeys = [$Data.tableData[0].id];
            $Data.activeRowKeys = [$Data.tableData[0].id];
        } else {
            $Data.currentRow = null;
        }
    },

    // 高亮行变化
    onActiveChange(value, { activeRowData }) {
        $Data.activeRowKeys = value;
        $Data.selectedRowKeys = value;
        if (activeRowData && activeRowData.length > 0) {
            $Data.currentRow = activeRowData[0];
        } else if ($Data.tableData.length > 0) {
            $Data.currentRow = $Data.tableData[0];
            $Data.selectedRowKeys = [$Data.tableData[0].id];
            $Data.activeRowKeys = [$Data.tableData[0].id];
        } else {
            $Data.currentRow = null;
        }
    }
};

$Method.initData();
</script>

<style scoped lang="scss">
// 样式继承自全局 page-table
</style>
