import type { FieldDefinition } from "befly/types/validate";

export const fieldsScheme: {
    id: FieldDefinition;
    page: FieldDefinition;
    limit: FieldDefinition;
    keyword: FieldDefinition;
    state: FieldDefinition;
} = {
    id: {
        name: "ID",
        type: "number",
        min: 1,
        max: null,
        default: null,
        regexp: null
    },
    page: {
        name: "页码",
        type: "number",
        min: 1,
        max: 9999,
        default: 1,
        regexp: null
    },
    limit: {
        name: "每页数量",
        type: "number",
        min: 1,
        max: 100,
        default: 30,
        regexp: null
    },
    keyword: {
        name: "关键词",
        type: "string",
        min: 0,
        max: 50,
        default: "",
        regexp: null
    },
    state: {
        name: "状态",
        type: "number",
        min: null,
        max: null,
        default: null,
        regexp: "^[0-2]$"
    }
};
