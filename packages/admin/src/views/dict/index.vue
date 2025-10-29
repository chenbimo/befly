<template>
    <div class="page-dict page-table">
        <div class="main-tool">
            <div class="left">
                <tiny-button type="primary" @click="$Method.onAction('add', {})">
                    <template #icon>
                        <Icon name="Plus" :size="16" />
                    </template>
                    添加字典
                </tiny-button>
            </div>
            <div class="right">
                <tiny-button @click="$Method.handleRefresh">
                    <template #icon>
                        <Icon name="RotateCw" :size="16" />
                    </template>
                    刷新
                </tiny-button>
            </div>
        </div>
        <div class="main-table">
            <tiny-grid :data="$Data.dictList" header-cell-class-name="custom-table-cell-class" size="small" height="100%" seq-serial>
                <tiny-grid-column type="index" title="序号" :width="60" />
                <tiny-grid-column field="name" title="字典名称" />
                <tiny-grid-column field="code" title="字典代码" :width="150" />
                <tiny-grid-column field="value" title="字典值" :width="200" />
                <tiny-grid-column field="pid" title="父级ID" :width="100" />
                <tiny-grid-column field="sort" title="排序" :width="80" />
                <tiny-grid-column field="description" title="描述" />
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
                                    <tiny-dropdown-item :item-data="{ command: 'upd' }">
                                        <Icon name="Edit" />
                                        编辑
                                    </tiny-dropdown-item>
                                    <tiny-dropdown-item :item-data="{ command: 'del' }" divided>
                                        <Icon name="Trash2" />
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
        <EditDialog v-if="$Data.editVisible" v-model="$Data.editVisible" :action-type="$Data.actionType" :row-data="$Data.rowData" @success="$Method.apiDictList" />
    </div>
</template>

<script setup>
import EditDialog from './components/edit.vue';

// 响应式数据
const $Data = $ref({
    dictList: [],
    pagerConfig: {
        currentPage: 1,
        pageSize: 30,
        total: 0,
        align: 'right',
        layout: 'total, prev, pager, next, jumper'
    },
    editVisible: false,
    actionType: 'add',
    rowData: {}
});

// 方法
const $Method = {
    async initData() {
        await $Method.apiDictList();
    },

    // 加载字典列表
    async apiDictList() {
        try {
            const res = await $Http('/core/dict/list', {
                page: $Data.pagerConfig.currentPage,
                limit: $Data.pagerConfig.pageSize
            });
            $Data.dictList = res.data.lists || [];
            $Data.pagerConfig.total = res.data.total || 0;
        } catch (error) {
            console.error('加载字典列表失败:', error);
            Modal.message({
                message: '加载数据失败',
                status: 'error'
            });
        }
    },

    // 删除字典
    async apiDictDel(row) {
        Modal.confirm({
            header: '确认删除',
            body: `确定要删除字典"${row.name}" 吗？`,
            status: 'warning'
        }).then(async () => {
            try {
                const res = await $Http('/core/dict/del', { id: row.id });
                if (res.code === 0) {
                    Modal.message({ message: '删除成功', status: 'success' });
                    $Method.apiDictList();
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
        $Method.apiDictList();
    },

    // 分页改变
    onPageChange({ currentPage }) {
        $Data.pagerConfig.currentPage = currentPage;
        $Method.apiDictList();
    },

    // 操作菜单点击
    onAction(command, rowData) {
        $Data.actionType = command;
        $Data.rowData = rowData;
        if (command === 'add' || command === 'upd') {
            $Data.editVisible = true;
        } else if (command === 'del') {
            $Method.apiDictDel(rowData);
        }
    }
};

$Method.initData();
</script>

<style scoped lang="scss">
// 样式继承自全局 page-table
</style>
