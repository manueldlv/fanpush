const fs = require("fs");
const { Client } = require("pg");

const envText = fs.readFileSync(".env", "utf8");
const env = {};

for (const line of envText.split(/\n/)) {
  const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!match) continue;
  env[match[1]] = match[2].replace(/^['"\s]+|['"\s]+$/g, "");
}

const sql = fs.readFileSync(
  "supabase/migrations/20260428000019_admin_audit_and_content_admin.sql",
  "utf8",
);

const projectRefMatch = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "")
  .match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
const projectRef = projectRefMatch ? projectRefMatch[1] : "";
const defaultUser =
  projectRef && !String(env.SUPABASE_USER || "").includes(".")
    ? `postgres.${projectRef}`
    : env.SUPABASE_USER || "postgres";

const client = new Client({
  host: env.SUPABASE_HOST || "aws-0-us-west-2.pooler.supabase.com",
  port: Number(env.SUPABASE_PORT || 5432),
  database: env.SUPABASE_DATABASE || "postgres",
  user: defaultUser,
  password: env.SUPABASE_PASSWORD || ".b&QzEq9&sc6ZZc",
  ssl: { rejectUnauthorized: false },
});

(async () => {
  await client.connect();
  await client.query(sql);

  const roles = await client.query(
    "select code from public.roles where code in ($1,$2) order by code",
    ["content_admin", "super_admin"],
  );
  const tables = await client.query(
    "select table_name from information_schema.tables where table_schema=$1 and table_name=$2",
    ["public", "admin_action_logs"],
  );

  console.log(
    JSON.stringify(
      {
        roles: roles.rows,
        tables: tables.rows,
      },
      null,
      2,
    ),
  );

  await client.end();
})().catch(async (error) => {
  console.error(error.message || error);
  try {
    await client.end();
  } catch {}
  process.exit(1);
});
