<template>
    <div class="page-dict-type page-table">
        <div class="main-tool">
            <div class="left">
                <TButton theme="primary" @click="$Method.onAction('add', {})">
                    <template #icon>
                        <ILucidePlus />
                    </template>
                </TButton>
            </div>
            <div class="right">
                <TInput v-model="$Data.searchKeyword" placeholder="搜索类型名称" clearable @enter="$Method.handleSearch" @clear="$Method.handleSearch">
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
                <TTable
                    :data="$Data.tableData"
                    :columns="$Data.columns"
                    :loading="$Data.loading"
                    :active-row-keys="$Data.activeRowKeys"
                    row-key="id"
                    height="calc(100vh - var(--search-height) - var(--pagination-height) - var(--layout-gap) * 4)"
                    active-row-type="single"
                    @active-change="$Method.onActiveChange"
                >
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

        <EditDialog v-if="$Data.editVisible" v-model="$Data.editVisible" :action-type="$Data.actionType" :row-data="$Data.rowData" @success="$Method.apiDictTypeList" />
    </div>
</template>

<script setup>
import { onMounted } from "vue";

import { Button as TButton, Table as TTable, Input as TInput, Dropdown as TDropdown, DropdownMenu as TDropdownMenu, DropdownItem as TDropdownItem, Pagination as TPagination, MessagePlugin, DialogPlugin } from "tdesign-vue-next";
import ILucidePlus from "~icons/lucide/plus";
import ILucideRotateCw from "~icons/lucide/rotate-cw";
import ILucideSearch from "~icons/lucide/search";
import ILucidePencil from "~icons/lucide/pencil";
import ILucideTrash2 from "~icons/lucide/trash-2";
import ILucideChevronDown from "~icons/lucide/chevron-down";
import EditDialog from "./components/edit.vue";
import DetailPanel from "@/components/DetailPanel.vue";
import { $Http } from "@/plugins/http";
import { withDefaultColumns } from "befly-shared/utils/withDefaultColumns";

definePage({
    meta: {
        title: "字典类型",
        order: 1
    }
});

const $Data = $ref({
    tableData: [],
    loading: false,
    activeRowKeys: [],
    currentRow: null,
    searchKeyword: "",
    columns: withDefaultColumns([
        { colKey: "code", title: "类型代码" },
        { colKey: "name", title: "类型名称" },
        { colKey: "description", title: "描述" },
        { colKey: "sort", title: "排序" },
        { colKey: "operation", title: "操作" }
    ]),
    pagerConfig: {
        currentPage: 1,
        limit: 30,
        total: 0,
        align: "right",
        layout: "total, prev, pager, next, jumper"
    },
    editVisible: false,
    actionType: "add",
    rowData: {}
});

const $Method = {
    async initData() {
        await $Method.apiDictTypeList();
    },
    async apiDictTypeList() {
        $Data.loading = true;
        try {
            const res = await $Http("/addon/admin/dictType/list", {
                page: $Data.pagerConfig.currentPage,
                limit: $Data.pagerConfig.limit,
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
            MessagePlugin.error("加载数据失败");
        } finally {
            $Data.loading = false;
        }
    },
    async apiDictTypeDel(row) {
        let dialog = null;
        let destroyed = false;

        const destroy = () => {
            if (destroyed) return;
            destroyed = true;
            if (dialog && typeof dialog.destroy === "function") {
                dialog.destroy();
            }
        };

        dialog = DialogPlugin.confirm({
            header: "确认删除",
            body: `确认删除类型“${row.name}”吗？`,
            status: "warning",
            confirmBtn: "删除",
            cancelBtn: "取消",
            onConfirm: async () => {
                if (dialog && typeof dialog.setConfirmLoading === "function") {
                    dialog.setConfirmLoading(true);
                }

                try {
                    await $Http("/addon/admin/dictType/del", { id: row.id });
                    MessagePlugin.success("删除成功");
                    destroy();
                    await $Method.apiDictTypeList();
                } catch (error) {
                    MessagePlugin.error("删除失败");
                } finally {
                    if (dialog && typeof dialog.setConfirmLoading === "function") {
                        dialog.setConfirmLoading(false);
                    }
                }
            },
            onClose: () => {
                destroy();
            }
        });
    },
    handleSearch() {
        $Data.pagerConfig.currentPage = 1;
        $Method.apiDictTypeList();
    },
    handleRefresh() {
        $Data.searchKeyword = "";
        $Data.pagerConfig.currentPage = 1;
        $Method.apiDictTypeList();
    },
    onPageChange({ currentPage }) {
        $Data.pagerConfig.currentPage = currentPage;
        $Method.apiDictTypeList();
    },
    handleSizeChange({ pageSize }) {
        $Data.pagerConfig.limit = pageSize;
        $Data.pagerConfig.currentPage = 1;
        $Method.apiDictTypeList();
    },
    onActiveChange(value, context) {
        if (value.length === 0 && $Data.activeRowKeys.length > 0) {
            return;
        }
        $Data.activeRowKeys = value;
        $Data.currentRow = context.currentRowData;
    },
    onAction(type, row) {
        if (type === "add") {
            $Data.actionType = "add";
            $Data.rowData = {};
            $Data.editVisible = true;
        } else if (type === "upd") {
            $Data.actionType = "upd";
            $Data.rowData = { ...row };
            $Data.editVisible = true;
        } else if (type === "del") {
            $Method.apiDictTypeDel(row);
        }
    }
};

onMounted(() => {
    $Method.initData();
});
</script>

<style scoped lang="scss">
.page-dict-type {
    .main-tool .right {
        display: flex;
        gap: 8px;
        align-items: center;

        .t-input {
            width: 240px;
        }
    }
}
</style>
