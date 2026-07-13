import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DB_URL });
const adminId = '879e9a62-98aa-4e07-a02e-04b867e5b7e1';
await pool.query(
  `insert into users (id, email, password_hash, name)
   values ($1, $2, $3, $4)
   on conflict (id) do update set email = excluded.email, password_hash = excluded.password_hash, name = excluded.name`,
  [adminId, 'admin@local.test', 'seeded:admin', 'Admin'],
);
await pool.end();
console.log('seeded admin user', adminId);
