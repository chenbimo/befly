import type { FieldDefinition } from "../types/validate";

export type NormalizedFieldDefinition = {
    name: string;
    type: string;
    detail: string;
    min: number | null;
    max: number | null;
    default: any | null;
    index: boolean;
    unique: boolean;
    nullable: boolean;
    unsigned: boolean;
    regexp: string | null;
};

export function normalizeFieldDefinition(fieldDef: FieldDefinition): NormalizedFieldDefinition {
    return {
        name: fieldDef.name,
        type: fieldDef.type,
        detail: fieldDef.detail ?? "",
        min: fieldDef.min ?? null,
        max: fieldDef.max ?? null,
        default: fieldDef.default ?? null,
        index: fieldDef.index ?? false,
        unique: fieldDef.unique ?? false,
        nullable: fieldDef.nullable ?? true,
        unsigned: fieldDef.unsigned ?? false,
        regexp: fieldDef.regexp ?? null
    };
}
