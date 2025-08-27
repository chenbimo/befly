import { Tool } from '../utils/tool.js';

export default {
    after: ['_redis', '_db'],
    async onInit(befly) {
        return new Tool(befly);
    }
};
