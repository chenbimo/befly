<template>
    <div class="page-admin page-table">
        <div class="main-tool">
            <div class="left">
                <tiny-button type="primary" @click="$Method.onAction('add', {})">
                    <template #icon>
                        <i-lucide:plus style="width: 16px; height: 16px" />
                    </template>
                    添加管理员
                </tiny-button>
            </div>
            <div class="right">
                <tiny-button @click="$Method.handleRefresh">
                    <template #icon>
                        <i-lucide:rotate-cw style="width: 16px; height: 16px" />
                    </template>
                </tiny-button>
            </div>
            <div class="right">
                <tiny-button @click="$Method.handleRefresh">
                    <template #icon>
                        <i-lucide:rotate-cw style="width: 16px; height: 16px" />
                    </template>
                    刷新
                </tiny-button>
            </div>
        </div>

        <div class="main-table">
            <tiny-grid :data="$Data.tableData" header-cell-class-name="custom-table-cell-class" size="small" height="100%" seq-serial>
                <tiny-grid-column type="index" title="序号" :width="60" />
                <tiny-grid-column field="username" title="用户名" />
                <tiny-grid-column field="email" title="邮箱" :width="200" />
                <tiny-grid-column field="nickname" title="昵称" :width="150" />
                <tiny-grid-column field="roleCode" title="角色" :width="120" />
                <tiny-grid-column field="state" title="状态" :width="100">
                    <template #default="{ row }">
                        <tiny-tag v-if="row.state === 1" type="success">正常</tiny-tag>
                        <tiny-tag v-else-if="row.state === 2" type="warning">禁用</tiny-tag>
                        <tiny-tag v-else type="danger">已删除</tiny-tag>
                    </template>
                </tiny-grid-column>
                <tiny-grid-column title="操作" :width="120" align="right">
                    <template #default="{ row }">
                        <tiny-dropdown title="操作" trigger="click" size="small" border visible-arrow @item-click="(data) => $Method.onAction(data.itemData.command, row)">
                            <template #dropdown>
                                <tiny-dropdown-menu>
                                    <tiny-dropdown-item :item-data="{ command: 'role' }">
                                        <i-lucide:user style="width: 14px; height: 14px; margin-right: 6px" />
                                        分配角色
                                    </tiny-dropdown-item>
                                    <tiny-dropdown-item :item-data="{ command: 'upd' }">
                                        <i-lucide:pencil style="width: 14px; height: 14px; margin-right: 6px" />
                                        编辑
                                    </tiny-dropdown-item>
                                    <tiny-dropdown-item :item-data="{ command: 'del' }" divided>
                                        <i-lucide:trash-2 style="width: 14px; height: 14px; margin-right: 6px" />
                                        删除
                                    </tiny-dropdown-item>
                                </tiny-dropdown-menu>
                            </template>
                        </tiny-dropdown>
                    </template>
                </tiny-grid-column>
            </tiny-grid>
        </div>

        <div class="main-page">
            <tiny-pager :current-page="$Data.pagerConfig.currentPage" :page-size="$Data.pagerConfig.pageSize" :total="$Data.pagerConfig.total" @current-change="$Method.onPageChange" @size-change="$Method.handleSizeChange" />
        </div>

        <!-- 编辑对话框组件 -->
        <EditDialog v-if="$Data.editVisible" v-model="$Data.editVisible" :action-type="$Data.actionType" :row-data="$Data.rowData" @success="$Method.apiAdminList" />

        <!-- 角色分配对话框组件 -->
        <RoleDialog v-if="$Data.roleVisible" v-model="$Data.roleVisible" :row-data="$Data.rowData" @success="$Method.apiAdminList" />
    </div>
</template>

<script setup>
import { ref } from 'vue';
import { Modal } from '@opentiny/vue';

import EditDialog from './components/edit.vue';
import RoleDialog from './components/role.vue';

// 响应式数据
const $Data = $ref({
    tableData: [],
    pagerConfig: {
        currentPage: 1,
        pageSize: 30,
        total: 0,
        align: 'right',
        layout: 'total, prev, pager, next, jumper'
    },
    editVisible: false,
    roleVisible: false,
    actionType: 'add',
    rowData: {}
});

// 方法
const $Method = {
    async initData() {
        await $Method.apiAdminList();
    },

    // 加载管理员列表
    async apiAdminList() {
        try {
            const res = await $Http('/addon/admin/list', {
                page: $Data.pagerConfig.currentPage,
                limit: $Data.pagerConfig.pageSize
            });
            $Data.tableData = res.data.lists || [];
            $Data.pagerConfig.total = res.data.total || 0;
        } catch (error) {
            console.error('加载管理员列表失败:', error);
            Modal.message({
                message: '加载数据失败',
                status: 'error'
            });
        }
    },

    // 删除管理员
    async apiAdminDel(row) {
        Modal.confirm({
            header: '确认删除',
            body: `确定要删除管理员"${row.username}" 吗？`,
            status: 'warning'
        }).then(async () => {
            try {
                const res = await $Http('/addon/admin/del', { id: row.id });
                if (res.code === 0) {
                    Modal.message({ message: '删除成功', status: 'success' });
                    $Method.apiAdminList();
                } else {
                    Modal.message({ message: res.msg || '删除失败', status: 'error' });
                }
            } catch (error) {
                console.error('删除失败:', error);
                Modal.message({ message: '删除失败', status: 'error' });
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

    // 操作菜单点击
    onAction(command, rowData) {
        $Data.actionType = command;
        $Data.rowData = rowData;
        if (command === 'add' || command === 'upd') {
            $Data.editVisible = true;
        } else if (command === 'role') {
            $Data.roleVisible = true;
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
