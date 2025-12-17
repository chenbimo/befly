<template>
    <div class="page-sys-config page-table">
        <div class="main-tool">
            <div class="left">
                <TButton theme="primary" @click="$Method.onAction('add', {})">
                    <template #icon>
                        <ILucidePlus />
                    </template>
                    新增配置
                </TButton>
                <TSelect v-model="$Data.filter.group" placeholder="配置分组" clearable style="width: 150px" @change="$Method.handleFilter">
                    <TOption v-for="item in $Data.groupOptions" :key="item" :label="item" :value="item" />
                </TSelect>
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
                    <template #isSystem="{ row }">
                        <TTag v-if="row.isSystem === 1" shape="round" theme="warning" variant="light-outline">系统</TTag>
                        <TTag v-else shape="round" variant="light-outline">自定义</TTag>
                    </template>
                    <template #valueType="{ row }">
                        <TTag shape="round" variant="light-outline">{{ row.valueType }}</TTag>
                    </template>
                    <template #state="{ row }">
                        <TTag v-if="row.state === 1" shape="round" theme="success" variant="light-outline">正常</TTag>
                        <TTag v-else-if="row.state === 2" shape="round" theme="warning" variant="light-outline">禁用</TTag>
                    </template>
                    <template #operation="{ row }">
                        <TDropdown trigger="click" placement="bottom-right" @click="(data) => $Method.onAction(data.value, row)">
                            <TButton theme="primary" size="small">
                                操作
                                <template #suffix><ILucideChevronDown /></template>
                            </TButton>
                            <TDropdownMenu slot="dropdown">
                                <TDropdownItem value="upd">
                                    <ILucidePencil />
                                    编辑
                                </TDropdownItem>
                                <TDropdownItem v-if="row.isSystem !== 1" value="del" :divider="true">
                                    <ILucideTrash2 style="width: 14px; height: 14px; margin-right: 6px" />
                                    删除
                                </TDropdownItem>
                            </TDropdownMenu>
                        </TDropdown>
                    </template>
                </TTable>
            </div>

            <div class="main-detail">
                <DetailPanel :data="$Data.currentRow" :fields="$Data.detailFields">
                    <template #isSystem="{ value }">
                        <TTag v-if="value === 1" shape="round" theme="warning" variant="light-outline">系统配置</TTag>
                        <TTag v-else shape="round" variant="light-outline">自定义配置</TTag>
                    </template>
                    <template #valueType="{ value }">
                        <TTag shape="round" variant="light-outline">{{ value }}</TTag>
                    </template>
                    <template #value="{ value }">
                        <pre class="config-value">{{ value }}</pre>
                    </template>
                </DetailPanel>
            </div>
        </div>

        <div class="main-page">
            <TPagination :current-page="$Data.pagerConfig.currentPage" :page-size="$Data.pagerConfig.limit" :total="$Data.pagerConfig.total" @current-change="$Method.onPageChange" @page-size-change="$Method.handleSizeChange" />
        </div>

        <!-- 编辑对话框 -->
        <EditDialog v-if="$Data.editVisible" v-model="$Data.editVisible" :action-type="$Data.actionType" :row-data="$Data.rowData" @success="$Method.apiConfigList" />
    </div>
</template>

<script setup>
import { Button as TButton, Table as TTable, Tag as TTag, Select as TSelect, Option as TOption, Dropdown as TDropdown, DropdownMenu as TDropdownMenu, DropdownItem as TDropdownItem, Pagination as TPagination, MessagePlugin } from "tdesign-vue-next";
import ILucidePlus from "~icons/lucide/plus";
import ILucideRotateCw from "~icons/lucide/rotate-cw";
import ILucidePencil from "~icons/lucide/pencil";
import ILucideTrash2 from "~icons/lucide/trash-2";
import ILucideChevronDown from "~icons/lucide/chevron-down";
import EditDialog from "./components/edit.vue";
import DetailPanel from "@/components/DetailPanel.vue";
import { $Http } from "@/plugins/http";
import { withDefaultColumns } from "befly-vite/utils/withDefaultColumns";
import { confirmDeleteAndRun } from "@/utils/confirmAndRun";

definePage({
    meta: {
        title: "系统配置",
        order: 2
    }
});

// 响应式数据
const $Data = $ref({
    tableData: [],
    loading: false,
    columns: withDefaultColumns([
        { colKey: "name", title: "配置名称", fixed: "left", width: 150 },
        { colKey: "id", title: "序号", width: 80 },
        { colKey: "code", title: "配置代码", ellipsis: true },
        { colKey: "value", title: "配置值", ellipsis: true, width: 200 },
        { colKey: "valueType", title: "值类型", width: 100 },
        { colKey: "group", title: "分组", width: 100 },
        { colKey: "sort", title: "排序", width: 80 },
        { colKey: "isSystem", title: "类型", width: 80 },
        { colKey: "state", title: "状态", width: 80 },
        { colKey: "operation", title: "操作", width: 100 }
    ]),
    detailFields: [
        { colKey: "name", title: "配置名称" },
        { colKey: "code", title: "配置代码" },
        { colKey: "value", title: "配置值" },
        { colKey: "valueType", title: "值类型" },
        { colKey: "group", title: "配置分组" },
        { colKey: "sort", title: "排序" },
        { colKey: "isSystem", title: "配置类型" },
        { colKey: "description", title: "描述说明" }
    ],
    pagerConfig: {
        currentPage: 1,
        limit: 30,
        total: 0
    },
    currentRow: null,
    activeRowKeys: [],
    editVisible: false,
    actionType: "add",
    rowData: {},
    filter: {
        group: ""
    },
    groupOptions: ["基础配置", "邮件配置", "存储配置", "安全配置", "其他"]
});

// 方法
const $Method = {
    async initData() {
        await $Method.apiConfigList();
    },

    // 加载配置列表
    async apiConfigList() {
        $Data.loading = true;
        try {
            const res = await $Http("/addon/admin/sysConfig/list", {
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

    // 删除配置
    async apiConfigDel(row) {
        if (row.isSystem === 1) {
            MessagePlugin.warning("系统配置不允许删除");
            return;
        }

        confirmDeleteAndRun({
            displayName: `配置“${row.name}”`,
            request: async () => {
                return await $Http("/addon/admin/sysConfig/del", { id: row.id });
            },
            onSuccess: async () => {
                await $Method.apiConfigList();
            }
        });
    },

    // 筛选
    handleFilter() {
        $Data.pagerConfig.currentPage = 1;
        $Method.apiConfigList();
    },

    // 刷新
    handleRefresh() {
        $Method.apiConfigList();
    },

    // 分页改变
    onPageChange(currentPage) {
        $Data.pagerConfig.currentPage = currentPage;
        $Method.apiConfigList();
    },

    // 每页条数改变
    handleSizeChange(pageSize) {
        $Data.pagerConfig.limit = pageSize;
        $Data.pagerConfig.currentPage = 1;
        $Method.apiConfigList();
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

    // 操作菜单点击
    onAction(command, rowData) {
        $Data.actionType = command;
        $Data.rowData = rowData;
        if (command === "add" || command === "upd") {
            $Data.editVisible = true;
        } else if (command === "del") {
            $Method.apiConfigDel(rowData);
        }
    }
};

$Method.initData();
</script>

<style scoped lang="scss">
.config-value {
    margin: 0;
    padding: 8px;
    background: var(--td-bg-color-container);
    border-radius: 4px;
    font-size: 12px;
    max-height: 150px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-all;
}
</style>
