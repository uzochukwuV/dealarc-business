import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DB_URL });
const res = await pool.query("select table_name from information_schema.tables where table_schema='public' order by table_name");
console.log(res.rows.map((r) => r.table_name).join('\n'));
await pool.end();
