import fs from "fs";
import path from "path";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "hotel_management_old_garden",
  user: process.env.DB_USER || "lizardking",
  password: process.env.DB_PASSWORD || "",
});

const MIGRATIONS_DIR = path.join(__dirname, "src", "database", "migrations");
// const MIGRATIONS_DIR = path.join(__dirname, "database", "migrations");

async function createMigrationTable() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      migration_name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await pool.query(createTableSQL);
}

async function getExecutedMigrations(): Promise<string[]> {
  const result = await pool.query(
    "SELECT migration_name FROM schema_migrations ORDER BY migration_name"
  );
  return result.rows.map((row) => row.migration_name);
}

async function getMigrationFiles(): Promise<string[]> {
  const files = fs.readdirSync(MIGRATIONS_DIR);
  return files.filter((file) => file.endsWith(".sql")).sort();
}

async function runMigration(filename: string) {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filePath, "utf8");

  console.log(`Running migration: ${filename}`);

  try {
    await pool.query("BEGIN");
    await pool.query(sql);
    await pool.query(
      "INSERT INTO schema_migrations (migration_name) VALUES ($1)",
      [filename]
    );
    await pool.query("COMMIT");
    console.log(`✓ Migration ${filename} completed successfully`);
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error(`✗ Migration ${filename} failed:`, error);
    throw error;
  }
}

async function rollbackMigration(filename: string) {
  console.log(`Rolling back migration: ${filename}`);

  try {
    await pool.query("BEGIN");
    await pool.query(
      "DELETE FROM schema_migrations WHERE migration_name = $1",
      [filename]
    );
    await pool.query("COMMIT");
    console.log(`✓ Rolled back ${filename}`);
    console.log("Note: Manual cleanup of database changes may be required");
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error(`✗ Rollback failed:`, error);
    throw error;
  }
}

async function migrateUp() {
  await createMigrationTable();

  const executed = await getExecutedMigrations();
  const available = await getMigrationFiles();
  const pending = available.filter((file) => !executed.includes(file));

  if (pending.length === 0) {
    console.log("No pending migrations");
    return;
  }

  console.log(`Found ${pending.length} pending migration(s)`);

  for (const file of pending) {
    await runMigration(file);
  }

  console.log("\n✓ All migrations completed successfully");
}

async function migrateDown() {
  await createMigrationTable();

  const executed = await getExecutedMigrations();

  if (executed.length === 0) {
    console.log("No migrations to rollback");
    return;
  }

  const lastMigration = executed[executed.length - 1];
  await rollbackMigration(lastMigration);
}

async function createMigration() {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T.]/g, "")
    .slice(0, 14);
  const args = process.argv.slice(3);
  const name = args.join("_") || "new_migration";
  const filename = `${timestamp}_${name}.sql`;
  const filepath = path.join(MIGRATIONS_DIR, filename);

  const template = `-- Migration: ${name.replace(/_/g, " ")}
-- Created: ${new Date().toISOString().split("T")[0]}

-- Write your migration SQL here

`;

  fs.writeFileSync(filepath, template);
  console.log(`Created migration: ${filename}`);
}

async function showStatus() {
  await createMigrationTable();

  const executed = await getExecutedMigrations();
  const available = await getMigrationFiles();
  const pending = available.filter((file) => !executed.includes(file));

  console.log("\n=== Migration Status ===\n");
  console.log(`Total migrations: ${available.length}`);
  console.log(`Executed: ${executed.length}`);
  console.log(`Pending: ${pending.length}\n`);

  if (executed.length > 0) {
    console.log("Executed migrations:");
    executed.forEach((file) => console.log(`  ✓ ${file}`));
  }

  if (pending.length > 0) {
    console.log("\nPending migrations:");
    pending.forEach((file) => console.log(`  ○ ${file}`));
  }

  console.log("");
}

async function main() {
  const command = process.argv[2];

  try {
    switch (command) {
      case "up":
        await migrateUp();
        break;
      case "down":
        await migrateDown();
        break;
      case "create":
        await createMigration();
        break;
      case "status":
        await showStatus();
        break;
      default:
        console.log("Usage:");
        console.log("  npm run migrate:up           - Run pending migrations");
        console.log("  npm run migrate:down         - Rollback last migration");
        console.log("  npm run migrate:create <name> - Create new migration");
        console.log("  npm run migrate:status       - Show migration status");
    }
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
