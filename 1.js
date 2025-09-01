const ql = (val) => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return String(val);
    const escaped = String(val).replace(/'/g, "''");
    return `'${escaped}'`;
};

console.log(ql('test'));
console.log(ql(123));
console.log(ql(null));
console.log(ql(undefined));
