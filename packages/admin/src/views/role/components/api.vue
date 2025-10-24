<template>
    <tiny-dialog-box v-model:visible="$Data.visible" title="接口权限" width="800px" :append-to-body="true" :show-footer="true" top="5vh" @close="$Method.onClose">
        <div class="comp-role-api">
            <!-- 搜索框 -->
            <div class="search-box">
                <tiny-input v-model="$Data.searchText" placeholder="搜索接口名称或路径" clearable @input="$Method.onSearch">
                    <template #prefix>
                        <icon-search />
                    </template>
                </tiny-input>
            </div>

            <!-- 操作按钮 -->
            <div class="action-buttons">
                <tiny-button size="small" @click="$Method.onCheckAll">全选</tiny-button>
                <tiny-button size="small" @click="$Method.onUncheckAll">取消全选</tiny-button>
                <tiny-button size="small" @click="$Method.onExpandAll">展开全部</tiny-button>
                <tiny-button size="small" @click="$Method.onCollapseAll">折叠全部</tiny-button>
            </div>

            <!-- 接口树 -->
            <div class="tree-container">
                <tiny-tree :data="$Data.filteredTreeData" node-key="id" show-checkbox default-expand-all :props="{ label: 'label', children: 'children' }" :ref="(el) => ($Form.tree = el)" :filter-node-method="$Method.filterNode" />
            </div>
        </div>

        <template #footer>
            <tiny-button @click="$Method.onClose">取消</tiny-button>
            <tiny-button type="primary" @click="$Method.onSubmit">保存</tiny-button>
        </template>
    </tiny-dialog-box>
</template>

<script setup>
import { IconSearch } from '@opentiny/vue-icon';

const $Prop = defineProps({
    modelValue: {
        type: Boolean,
        default: false
    },
    rowData: {
        type: Object,
        default: () => ({})
    }
});

const $Emit = defineEmits(['update:modelValue', 'success']);

// 表单引用
const $Form = $shallowRef({
    tree: null
});

const $Data = $ref({
    visible: false,
    apiTreeData: [],
    filteredTreeData: [],
    searchText: '',
    checkedKeys: []
});

// 方法集合
const $Method = {
    async initData() {
        await Promise.all([$Method.apiApiAll(), $Method.apiRoleApiDetail()]);
        $Data.filteredTreeData = $Data.apiTreeData;
        $Method.onShow();
    },

    onShow() {
        setTimeout(() => {
            $Data.visible = $Prop.modelValue;
        }, 100);
    },

    onClose() {
        $Data.visible = false;
        setTimeout(() => {
            $Emit('update:modelValue', false);
        }, 300);
    },

    // 加载所有接口
    async apiApiAll() {
        try {
            const res = await $Http('/addon/admin/apiAll');

            // 将接口列表转换为树形结构
            const apiMap = new Map();

            res.data.lists.forEach((api) => {
                const addonName = api.addonName || '项目接口';

                if (!apiMap.has(addonName)) {
                    apiMap.set(addonName, {
                        id: `addon_${addonName}`,
                        label: addonName,
                        children: []
                    });
                }

                apiMap.get(addonName).children.push({
                    id: api.id,
                    label: `${api.name} [${api.method} ${api.path}]`,
                    description: api.description,
                    isLeaf: true
                });
            });

            $Data.apiTreeData = Array.from(apiMap.values());
        } catch (error) {
            console.error('加载接口失败:', error);
            Modal.message({ message: '加载接口失败', status: 'error' });
        }
    },

    // 加载该角色已分配的接口
    async apiRoleApiDetail() {
        if (!$Prop.rowData.id) return;

        try {
            const res = await $Http('/addon/admin/roleApiDetail', {
                roleId: $Prop.rowData.id
            });

            $Data.checkedKeys = res.data.apiIds || [];

            // 等待树渲染完成后设置选中状态
            nextTick(() => {
                if ($Form.tree) {
                    $Form.tree.setCheckedKeys($Data.checkedKeys);
                }
            });
        } catch (error) {
            console.error('加载角色接口失败:', error);
        }
    },

    // 搜索过滤
    onSearch() {
        if (!$Data.searchText) {
            $Data.filteredTreeData = $Data.apiTreeData;
            return;
        }

        const searchLower = $Data.searchText.toLowerCase();
        $Data.filteredTreeData = $Data.apiTreeData
            .map((addon) => ({
                ...addon,
                children: addon.children.filter((api) => api.label.toLowerCase().includes(searchLower))
            }))
            .filter((addon) => addon.children.length > 0);
    },

    // 节点过滤方法
    filterNode(value, data) {
        if (!value) return true;
        return data.label.toLowerCase().includes(value.toLowerCase());
    },

    // 全选
    onCheckAll() {
        if (!$Form.tree) return;

        const allLeafIds = [];
        $Data.apiTreeData.forEach((addon) => {
            addon.children.forEach((api) => {
                if (api.isLeaf) {
                    allLeafIds.push(api.id);
                }
            });
        });

        $Form.tree.setCheckedKeys(allLeafIds);
    },

    // 取消全选
    onUncheckAll() {
        if (!$Form.tree) return;
        $Form.tree.setCheckedKeys([]);
    },

    // 展开全部
    onExpandAll() {
        if (!$Form.tree) return;

        const allNodeIds = [];
        $Data.apiTreeData.forEach((addon) => {
            allNodeIds.push(addon.id);
        });

        allNodeIds.forEach((id) => {
            const node = $Form.tree.getNode(id);
            if (node) {
                node.expanded = true;
            }
        });
    },

    // 折叠全部
    onCollapseAll() {
        if (!$Form.tree) return;

        const allNodeIds = [];
        $Data.apiTreeData.forEach((addon) => {
            allNodeIds.push(addon.id);
        });

        allNodeIds.forEach((id) => {
            const node = $Form.tree.getNode(id);
            if (node) {
                node.expanded = false;
            }
        });
    },

    // 提交表单
    async onSubmit() {
        try {
            if (!$Form.tree) {
                Modal.message({ message: '接口树未初始化', status: 'error' });
                return;
            }

            // 获取选中的叶子节点（只保存接口 ID，不包括分组节点）
            const checkedKeys = $Form.tree.getCheckedKeys();
            const apiIds = checkedKeys.filter((key) => typeof key === 'number');

            const res = await $Http('/addon/admin/roleApiSave', {
                roleId: $Prop.rowData.id,
                apiIds: JSON.stringify(apiIds)
            });

            if (res.code === 0) {
                Modal.message({
                    message: '保存成功',
                    status: 'success'
                });
                $Data.visible = false;
                $Emit('success');
            } else {
                Modal.message({
                    message: res.msg || '保存失败',
                    status: 'error'
                });
            }
        } catch (error) {
            console.error('保存失败:', error);
            Modal.message({
                message: '保存失败',
                status: 'error'
            });
        }
    }
};

$Method.initData();
</script>

<style scoped lang="scss">
.comp-role-api {
    height: 60vh;
    display: flex;
    flex-direction: column;
    gap: 12px;

    .search-box {
        padding-bottom: 8px;
        border-bottom: 1px solid var(--ti-common-color-line-dividing);
    }

    .action-buttons {
        display: flex;
        gap: 8px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--ti-common-color-line-dividing);
    }

    .tree-container {
        flex: 1;
        overflow-y: auto;
        padding: 8px 0;

        :deep(.tiny-tree) {
            .tiny-tree-node__content {
                padding: 4px 0;

                &:hover {
                    background-color: var(--ti-common-color-hover-background);
                }
            }
        }
    }
}
</style>
