const sql = new Bun.SQL({
    adapter: 'mysql',
    hostname: 'localhost',
    username: 'root2',
    password: 'root2',
    bigint: false
});

const [{ x }] = await sql`SELECT 10000000000000 as x`;

console.log(typeof x, x); // "string" 10000000000000233
