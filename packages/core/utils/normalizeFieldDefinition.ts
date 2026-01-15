import type { JsonValue } from "../types/common";
import type { FieldDefinition } from "../types/validate";

export type NormalizedFieldDefinition = {
    name: string;
    type: string;
    input: string;
    detail: string;
    min: number | null;
    max: number | null;
    precision: number | null;
    scale: number | null;
    default: JsonValue | null;
    index: boolean;
    unique: boolean;
    nullable: boolean;
    unsigned: boolean;
};

function inferInputByType(dbType: string): string {
    switch (dbType.toLowerCase()) {
        case "tinyint":
        case "smallint":
        case "mediumint":
        case "int":
        case "bigint":
            return "integer";
        case "decimal":
            return "number";
        case "char":
        case "varchar":
        case "tinytext":
        case "text":
        case "mediumtext":
        case "longtext":
            return "string";
        case "datetime":
            return "string";
        case "json":
            return "json";
        default:
            return "string";
    }
}

function normalizeTypeAndInput(fieldDef: FieldDefinition): { type: string; input: string } {
    const rawType = String(fieldDef.type ?? "").trim();
    const rawInput = typeof fieldDef.input === "string" ? fieldDef.input.trim() : "";

    const inferredInput = rawInput || inferInputByType(rawType);
    return { type: rawType, input: inferredInput };
}

export function normalizeFieldDefinition(fieldDef: FieldDefinition): NormalizedFieldDefinition {
    const typeAndInput = normalizeTypeAndInput(fieldDef);
    let normalizedDefault = fieldDef.default ?? null;

    if (normalizedDefault === null) {
        if (typeAndInput.input === "array" || typeAndInput.input === "array_number" || typeAndInput.input === "array_integer") {
            normalizedDefault = "[]";
        }
    }

    return {
        name: fieldDef.name,
        type: typeAndInput.type,
        input: typeAndInput.input,
        detail: fieldDef.detail ?? "",
        min: fieldDef.min ?? null,
        max: fieldDef.max ?? null,
        precision: fieldDef.precision ?? null,
        scale: fieldDef.scale ?? null,
        default: normalizedDefault,
        index: fieldDef.index ?? false,
        unique: fieldDef.unique ?? false,
        nullable: fieldDef.nullable ?? false,
        unsigned: fieldDef.unsigned ?? false
    };
}
