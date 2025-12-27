import { describe, expect, test } from "bun:test";

import { deepTransformKeys } from "befly-shared/utils/deepTransformKeys";

describe("befly-shared/deepTransformKeys", () => {
    test("preset: camel should convert object keys deeply", () => {
        const input = {
            user_id: 1,
            user_info: {
                first_name: "John",
                last_name: "Doe"
            },
            user_list: [{ tag_name: "vip" }]
        };

        const out = deepTransformKeys<any>(input, "camel");
        expect(out.userId).toBe(1);
        expect(out.userInfo.firstName).toBe("John");
        expect(out.userInfo.lastName).toBe("Doe");
        expect(out.userList[0].tagName).toBe("vip");
    });

    test("excludeKeys should keep key unchanged", () => {
        const input = { _id: "123", user_name: "John" };
        const out = deepTransformKeys<any>(input, "camel", { excludeKeys: ["_id"] });
        expect(out._id).toBe("123");
        expect(out.userName).toBe("John");
    });

    test("maxDepth should stop transforming beyond depth", () => {
        const input = { a_b: { c_d: { e_f: 1 } } };
        const out = deepTransformKeys<any>(input, "camel", { maxDepth: 1 });

        // depth=0: root transformed
        expect(out.aB).toBeTruthy();
        // depth>=1: should keep original object reference and keys
        expect(out.aB.c_d).toBeTruthy();
        expect(out.aB.cD).toBeUndefined();
    });

    test("should not throw on cyclic references", () => {
        const obj: any = { a_b: 1 };
        obj.self = obj;

        const out = deepTransformKeys<any>(obj, "camel");
        expect(out.aB).toBe(1);

        // current behavior: cycle hit returns original object
        expect(out.self).toBe(obj);
    });
});
