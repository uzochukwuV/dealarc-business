import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DB_URL });
const res = await pool.query("select column_name, data_type from information_schema.columns where table_schema='public' and table_name='users' order by ordinal_position");
console.log(JSON.stringify(res.rows, null, 2));
await pool.end();
