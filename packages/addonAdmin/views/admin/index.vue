<template>
    <div class="page-admin page-table">
        <div class="main-tool">
            <div class="left">
                <TButton theme="primary" @click="$Method.onAction('add', {})">
                    <template #icon>
                        <ILucidePlus />
                    </template>
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
                <TTable :data="$Data.tableData" :columns="$Data.columns" row-key="id" :selected-row-keys="$Data.selectedRowKeys" active-row-type="single" :active-row-keys="$Data.activeRowKeys" @select-change="$Method.onSelectChange" @active-change="$Method.onActiveChange">
                    <template #state="{ row }">
                        <TTag v-if="row.state === 1" shape="round" theme="success" variant="light-outline">正常</TTag>
                        <TTag v-else-if="row.state === 2" shape="round" theme="warning" variant="light-outline">禁用</TTag>
                        <TTag v-else-if="row.state === 0" shape="round" theme="danger" variant="light-outline">删除</TTag>
                    </template>
                    <template #operation="{ row }">
                        <TDropdown trigger="click" placement="bottom-right" @click="(data) => $Method.onAction(data.value, row)">
                            <TButton theme="primary" size="small">操作</TButton>
                            <TDropdownMenu slot="dropdown">
                                <TDropdownItem value="upd">
                                    <ILucidePencil />
                                    编辑
                                </TDropdownItem>
                                <TDropdownItem value="del" :divider="true">
                                    <ILucideTrash2 />
                                    删除
                                </TDropdownItem>
                            </TDropdownMenu>
                        </TDropdown>
                    </template>
                </TTable>
            </div>

            <div class="main-detail">
                <div class="detail-content">
                    <div v-if="$Data.currentRow">
                        <div style="margin-bottom: 16px">
                            <div style="color: var(--text-secondary); margin-bottom: 4px">ID</div>
                            <div>{{ $Data.currentRow.id }}</div>
                        </div>
                        <div style="margin-bottom: 16px">
                            <div style="color: var(--text-secondary); margin-bottom: 4px">用户名</div>
                            <div>{{ $Data.currentRow.username }}</div>
                        </div>
                        <div style="margin-bottom: 16px">
                            <div style="color: var(--text-secondary); margin-bottom: 4px">邮箱</div>
                            <div>{{ $Data.currentRow.email }}</div>
                        </div>
                        <div style="margin-bottom: 16px">
                            <div style="color: var(--text-secondary); margin-bottom: 4px">昵称</div>
                            <div>{{ $Data.currentRow.nickname || '-' }}</div>
                        </div>
                        <div style="margin-bottom: 16px">
                            <div style="color: var(--text-secondary); margin-bottom: 4px">角色</div>
                            <div>{{ $Data.currentRow.roleCode || '-' }}</div>
                        </div>
                        <div style="margin-bottom: 16px">
                            <div style="color: var(--text-secondary); margin-bottom: 4px">状态</div>
                            <TTag v-if="$Data.currentRow.state === 1" theme="success">正常</TTag>
                            <TTag v-else-if="$Data.currentRow.state === 2" theme="warning">禁用</TTag>
                            <TTag v-else theme="danger">已删除</TTag>
                        </div>
                    </div>
                    <div v-else style="text-align: center; padding: 48px 0; color: var(--text-placeholder)">
                        <div style="font-size: 48px; margin-bottom: 8px">📋</div>
                        <div>暂无数据</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="main-page">
            <TPagination :current-page="$Data.pagerConfig.currentPage" :page-size="$Data.pagerConfig.pageSize" :total="$Data.pagerConfig.total" @current-change="$Method.onPageChange" @size-change="$Method.handleSizeChange" />
        </div>

        <!-- 编辑对话框组件 -->
        <EditDialog v-if="$Data.editVisible" v-model="$Data.editVisible" :action-type="$Data.actionType" :row-data="$Data.rowData" @success="$Method.apiAdminList" />
    </div>
</template>

<script setup>
import { Button as TButton, Table as TTable, Tag as TTag, Dropdown as TDropdown, DropdownMenu as TDropdownMenu, DropdownItem as TDropdownItem, Pagination as TPagination, MessagePlugin, DialogPlugin } from 'tdesign-vue-next';
import ILucidePlus from '~icons/lucide/plus';
import ILucideRotateCw from '~icons/lucide/rotate-cw';
import ILucidePencil from '~icons/lucide/pencil';
import ILucideTrash2 from '~icons/lucide/trash-2';
import EditDialog from './components/edit.vue';
import { $Http } from '@/plugins/http';

// 响应式数据
const $Data = $ref({
    tableData: [],
    columns: [
        {
            colKey: 'row-select',
            type: 'single',
            width: 50,
            fixed: 'left',
            checkProps: { allowUncheck: true }
        },
        { colKey: 'username', title: '用户名', width: 150, fixed: 'left' },
        { colKey: 'id', title: '序号', width: 150, align: 'center' },
        { colKey: 'email', title: '邮箱', width: 200 },
        { colKey: 'nickname', title: '昵称', width: 150 },
        { colKey: 'roleCode', title: '角色', width: 120 },
        { colKey: 'state', title: '状态', width: 100 },
        { colKey: 'operation', title: '操作', width: 80, align: 'center', fixed: 'right' }
    ],
    pagerConfig: {
        currentPage: 1,
        pageSize: 30,
        total: 0,
        align: 'right',
        layout: 'total, prev, pager, next, jumper'
    },
    editVisible: false,
    actionType: 'add',
    rowData: {},
    currentRow: null,
    selectedRowKeys: [],
    activeRowKeys: []
});

// 方法
const $Method = {
    async initData() {
        await $Method.apiAdminList();
    },

    // 加载管理员列表
    async apiAdminList() {
        try {
            const res = await $Http('/addon/admin/admin/list', {
                page: $Data.pagerConfig.currentPage,
                limit: $Data.pagerConfig.pageSize
            });
            $Data.tableData = res.data.lists || [];
            $Data.pagerConfig.total = res.data.total || 0;

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
            console.error('加载管理员列表失败:', error);
            MessagePlugin.info({
                message: '加载数据失败',
                status: 'error'
            });
        }
    },

    // 删除管理员
    async apiAdminDel(row) {
        DialogPlugin.confirm({
            header: '确认删除',
            body: `确定要删除管理员"${row.username}" 吗？`,
            status: 'warning'
        }).then(async () => {
            try {
                const res = await $Http('/addon/admin/admin/del', { id: row.id });
                if (res.code === 0) {
                    MessagePlugin.info({ message: '删除成功', status: 'success' });
                    $Method.apiAdminList();
                } else {
                    MessagePlugin.info({ message: res.msg || '删除失败', status: 'error' });
                }
            } catch (error) {
                console.error('删除失败:', error);
                MessagePlugin.info({ message: '删除失败', status: 'error' });
            }
        });
    },

    // 刷新
    handleRefresh() {
        $Method.apiAdminList();
    },

    // 分页改变
    onPageChange({ currentPage }) {
        $Data.pagerConfig.currentPage = currentPage;
        $Method.apiAdminList();
    },

    // 每页条数改变
    handleSizeChange({ pageSize }) {
        $Data.pagerConfig.pageSize = pageSize;
        $Data.pagerConfig.currentPage = 1;
        $Method.apiAdminList();
    },

    // 单选变化
    onSelectChange(value, { selectedRowData }) {
        $Data.selectedRowKeys = value;
        $Data.activeRowKeys = value;
        // 更新当前选中的行数据
        if (selectedRowData && selectedRowData.length > 0) {
            $Data.currentRow = selectedRowData[0];
        } else if ($Data.tableData.length > 0) {
            // 如果取消选中，默认显示第一行
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
        // 更新当前高亮的行数据
        if (activeRowData && activeRowData.length > 0) {
            $Data.currentRow = activeRowData[0];
        } else if ($Data.tableData.length > 0) {
            // 如果取消高亮，默认显示第一行
            $Data.currentRow = $Data.tableData[0];
            $Data.selectedRowKeys = [$Data.tableData[0].id];
            $Data.activeRowKeys = [$Data.tableData[0].id];
        } else {
            $Data.currentRow = null;
        }
    },

    // 操作菜单点击
    onAction(command, rowData) {
        $Data.actionType = command;
        $Data.rowData = rowData;
        if (command === 'add' || command === 'upd') {
            $Data.editVisible = true;
        } else if (command === 'del') {
            $Method.apiAdminDel(rowData);
        }
    }
};

$Method.initData();
</script>

<style scoped lang="scss">
// 样式继承自全局 page-table
</style>
