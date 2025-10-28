/**
 * 获取插件列表
 */

import { Yes } from '../../util.js';
import { getAddonList } from '../util.js';

export default {
    name: '获取插件列表',
    handler: async (befly, ctx) => {
        const addonList = getAddonList();
        return Yes('获取成功', addonList);
    }
};
