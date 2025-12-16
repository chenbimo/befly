<template>
    <div class="page-dict page-table">
        <div class="main-tool">
            <div class="left">
                <TButton theme="primary" @click="$Method.onAction('add', {})">
                    <template #icon>
                        <ILucidePlus />
                    </template>
                </TButton>
            </div>
            <div class="right">
                <TSelect v-model="$Data.searchTypeCode" placeholder="请选择字典类型" clearable filterable @change="$Method.handleSearch">
                    <TOption v-for="item in $Data.typeList" :key="item.code" :value="item.code" :label="item.name" />
                </TSelect>
                <TInput v-model="$Data.searchKeyword" placeholder="搜索键/标签" clearable @enter="$Method.handleSearch" @clear="$Method.handleSearch">
                    <template #suffix-icon>
                        <ILucideSearch />
                    </template>
                </TInput>
                <TButton shape="circle" @click="$Method.handleRefresh">
                    <template #icon>
                        <ILucideRotateCw />
                    </template>
                </TButton>
            </div>
        </div>
        <div class="main-content">
            <div class="main-table">
                <TTable :data="$Data.tableData" :columns="$Data.columns" :loading="$Data.loading" :active-row-keys="$Data.activeRowKeys" row-key="id" height="calc(100vh - var(--search-height) - var(--pagination-height) - var(--layout-gap) * 4)" active-row-type="single" @active-change="$Method.onActiveChange">
                    <template #operation="{ row }">
                        <TDropdown trigger="click" placement="bottom-right" @click="(data) => $Method.onAction(data.value, row)">
                            <TButton theme="primary" size="small">
                                操作
                                <template #suffix> <ILucideChevronDown /></template>
                            </TButton>
                            <TDropdownMenu slot="dropdown">
                                <TDropdownItem value="upd">
                                    <ILucidePencil />
                                    编辑
                                </TDropdownItem>
                                <TDropdownItem value="del" :divider="true">
                                    <ILucideTrash2 style="width: 14px; height: 14px; margin-right: 6px" />
                                    删除
                                </TDropdownItem>
                            </TDropdownMenu>
                        </TDropdown>
                    </template>
                </TTable>
            </div>

            <div class="main-detail">
                <DetailPanel :data="$Data.currentRow" :fields="$Data.columns" />
            </div>
        </div>

        <div class="main-page">
            <TPagination :current-page="$Data.pagerConfig.currentPage" :page-size="$Data.pagerConfig.limit" :total="$Data.pagerConfig.total" @current-change="$Method.onPageChange" @page-size-change="$Method.handleSizeChange" />
        </div>

        <EditDialog v-if="$Data.editVisible" v-model="$Data.editVisible" :action-type="$Data.actionType" :row-data="$Data.rowData" :type-list="$Data.typeList" @success="$Method.apiDictList" />
    </div>
</template>

<script setup>
import { Button as TButton, Table as TTable, Input as TInput, Select as TSelect, Option as TOption, Dropdown as TDropdown, DropdownMenu as TDropdownMenu, DropdownItem as TDropdownItem, Pagination as TPagination, MessagePlugin } from 'tdesign-vue-next';
import ILucidePlus from '~icons/lucide/plus';
import ILucideRotateCw from '~icons/lucide/rotate-cw';
import ILucideSearch from '~icons/lucide/search';
import ILucidePencil from '~icons/lucide/pencil';
import ILucideTrash2 from '~icons/lucide/trash-2';
import ILucideChevronDown from '~icons/lucide/chevron-down';
import EditDialog from './components/edit.vue';
import DetailPanel from '@/components/DetailPanel.vue';
import { $Http } from '@/plugins/http';
import { withDefaultColumns } from 'befly-vite/utils/withDefaultColumns';
import { confirmDeleteAndRun } from '@/utils/confirmAndRun';

const $Data = $ref({
    tableData: [],
    typeList: [],
    loading: false,
    activeRowKeys: [],
    currentRow: null,
    searchTypeCode: '',
    searchKeyword: '',
    columns: withDefaultColumns([
        { colKey: 'id', title: 'ID' },
        { colKey: 'typeName', title: '类型名称' },
        { colKey: 'typeCode', title: '类型代码' },
        { colKey: 'label', title: '标签' },
        { colKey: 'key', title: '键值' },
        { colKey: 'sort', title: '排序', width: 100 },
        { colKey: 'remark', title: '备注' },
        { colKey: 'operation', title: '操作' }
    ]),
    pagerConfig: {
        currentPage: 1,
        limit: 30,
        total: 0,
        align: 'right',
        layout: 'total, prev, pager, next, jumper'
    },
    editVisible: false,
    actionType: 'add',
    rowData: {}
});

const $Method = {
    async initData() {
        await $Method.apiDictTypeAll();
        await $Method.apiDictList();
    },
    async apiDictTypeAll() {
        try {
            const res = await $Http('/addon/admin/dictType/all');
            $Data.typeList = res.data.lists || [];
        } catch (error) {
            MessagePlugin.error('加载数据失败');
        }
    },
    async apiDictList() {
        $Data.loading = true;
        try {
            const res = await $Http('/addon/admin/dict/list', {
                page: $Data.pagerConfig.currentPage,
                limit: $Data.pagerConfig.limit,
                typeCode: $Data.searchTypeCode,
                keyword: $Data.searchKeyword
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
            MessagePlugin.error('加载数据失败');
        } finally {
            $Data.loading = false;
        }
    },
    async apiDictDel(row) {
        confirmDeleteAndRun({
            displayName: `字典项“${row.label}”`,
            request: async () => {
                return await $Http('/addon/admin/dict/del', { id: row.id });
            },
            onSuccess: async () => {
                await $Method.apiDictList();
            }
        });
    },
    handleSearch() {
        $Data.pagerConfig.currentPage = 1;
        $Method.apiDictList();
    },
    handleRefresh() {
        $Data.searchTypeCode = '';
        $Data.searchKeyword = '';
        $Data.pagerConfig.currentPage = 1;
        $Method.apiDictList();
    },
    onPageChange({ currentPage }) {
        $Data.pagerConfig.currentPage = currentPage;
        $Method.apiDictList();
    },
    handleSizeChange({ pageSize }) {
        $Data.pagerConfig.limit = pageSize;
        $Data.pagerConfig.currentPage = 1;
        $Method.apiDictList();
    },
    onActiveChange(value, context) {
        if (value.length === 0 && $Data.activeRowKeys.length > 0) {
            return;
        }
        $Data.activeRowKeys = value;
        $Data.currentRow = context.currentRowData;
    },
    onAction(type, row) {
        if (type === 'add') {
            $Data.actionType = 'add';
            $Data.rowData = {};
            $Data.editVisible = true;
        } else if (type === 'upd') {
            $Data.actionType = 'upd';
            $Data.rowData = { ...row };
            $Data.editVisible = true;
        } else if (type === 'del') {
            $Method.apiDictDel(row);
        }
    }
};

onMounted(() => {
    $Method.initData();
});
</script>

<style scoped lang="scss">
.page-dict {
    .main-tool .right {
        display: flex;
        gap: 8px;
        align-items: center;

        .t-select {
            width: 200px;
        }

        .t-input {
            width: 240px;
        }
    }
}
</style>
