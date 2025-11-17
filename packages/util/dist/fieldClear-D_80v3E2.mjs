//#region src/fieldClear.ts
function isObject(val) {
	return val !== null && typeof val === "object" && !Array.isArray(val);
}
function isArray(val) {
	return Array.isArray(val);
}
function fieldClear(data, options = {}) {
	const { pickKeys, omitKeys, keepValues, excludeValues } = options;
	const filterObj = (obj) => {
		let result = {};
		let keys = Object.keys(obj);
		if (pickKeys && pickKeys.length) keys = keys.filter((k) => pickKeys.includes(k));
		if (omitKeys && omitKeys.length) keys = keys.filter((k) => !omitKeys.includes(k));
		for (const key of keys) {
			const value = obj[key];
			if (keepValues && keepValues.length && !keepValues.includes(value)) continue;
			if (excludeValues && excludeValues.length && excludeValues.includes(value)) continue;
			result[key] = value;
		}
		return result;
	};
	if (isArray(data)) return data.map((item) => isObject(item) ? filterObj(item) : item).filter((item) => {
		if (isObject(item)) return Object.keys(item).length > 0;
		return true;
	});
	if (isObject(data)) return filterObj(data);
	return data;
}

//#endregion
export { fieldClear as t };