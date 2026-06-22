import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { config } from "../config.js";

fs.mkdirSync(config.dataDir, { recursive: true });

const sqlitePath = path.join(config.dataDir, "app.db");

export const sqlite = new DatabaseSync(sqlitePath);
sqlite.exec("PRAGMA foreign_keys = ON");
sqlite.exec("PRAGMA journal_mode = WAL");

runMigrations(sqlite);

export function persistDatabase(): void {
  // node:sqlite writes to the on-disk database synchronously.
}

export function sqliteAll<T extends object>(sql: string, params: unknown[] = []): T[] {
  return sqlite.prepare(sql).all(...(params as SQLInputValue[])) as T[];
}

export function sqliteGet<T extends object>(sql: string, params: unknown[] = []): T | null {
  return (sqlite.prepare(sql).get(...(params as SQLInputValue[])) as T | undefined) ?? null;
}

export function sqliteRun(sql: string, params: unknown[] = []): void {
  sqlite.prepare(sql).run(...(params as SQLInputValue[]));
}

function runMigrations(database: DatabaseSync): void {
  database.exec("CREATE TABLE IF NOT EXISTS __drizzle_migrations (id TEXT PRIMARY KEY NOT NULL, applied_at INTEGER NOT NULL)");

  const journalPath = path.resolve(process.cwd(), "drizzle", "meta", "_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as { entries: Array<{ tag: string }> };

  for (const entry of journal.entries) {
    const applied = database.prepare("SELECT id FROM __drizzle_migrations WHERE id = ?").get(entry.tag) as { id?: string } | undefined;
    if (applied?.id) continue;

    const migrationPath = path.resolve(process.cwd(), "drizzle", `${entry.tag}.sql`);
    const statements = fs
      .readFileSync(migrationPath, "utf8")
      .split("--> statement-breakpoint")
      .map((migrationStatement) => migrationStatement.trim())
      .filter(Boolean);

    database.exec("BEGIN");
    try {
      for (const migrationStatement of statements) {
        database.exec(migrationStatement);
      }
      database.prepare("INSERT INTO __drizzle_migrations (id, applied_at) VALUES (?, ?)").run(entry.tag, Date.now());
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}
