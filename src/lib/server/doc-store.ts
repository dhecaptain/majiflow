import { promises as fs } from "node:fs";
import path from "node:path";
import { and, arrayContains, eq, inArray, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { getDatabase } from "@/lib/server/db";

/**
 * Document storage for orders and payments.
 *
 * Each record is a JSON document. In Postgres it sits in a `data` column next
 * to copies of the fields the app filters on; on disk (local development and
 * tests) it sits in one JSON file per collection. Both backends give the same
 * guarantees to callers: `update` is an atomic read-modify-write of a single
 * document, and `insert` refuses a duplicate id or unique key.
 */

/** A filter value: one value to match, or a list meaning "any of these". */
export type FilterValue = string | readonly string[] | undefined;

export interface DocumentStore<T> {
  get(id: string): Promise<T | null>;
  /** Every document matching all given fields; array-valued fields match by containment. */
  find(filter?: Record<string, FilterValue>): Promise<T[]>;
  /** Store a new document. Returns false when the id or a unique key is already taken. */
  insert(doc: T): Promise<boolean>;
  /**
   * Run `fn` on a private copy of the document while holding it locked, then
   * write the copy back. `fn` changes the copy in place and returns the result.
   * Returns null when the document does not exist.
   */
  update<R>(id: string, fn: (draft: T) => R | Promise<R>): Promise<R | null>;
}

export interface CollectionConfig<T> {
  /** Name of the JSON file used by the file backend. */
  name: string;
  table: PgTable & { id: PgColumn; data: PgColumn; updatedAt: PgColumn };
  id: (doc: T) => string;
  /** Column values written next to the document on every insert and update. */
  columns: (doc: T) => Record<string, unknown>;
  /** Filterable fields: the column to query and how to read the value from a document. */
  fields: Record<string, { column: PgColumn; read: (doc: T) => string | readonly string[] | null | undefined }>;
  /** Fields that must be unique across documents when set. */
  unique?: string[];
}

/**
 * Where documents live. Postgres whenever a database is configured; a local
 * file only in development and tests, and never silently in production.
 */
export function storageBackend(): "postgres" | "file" {
  if (process.env.MF_DATA_DIR) return "file";
  if (process.env.DATABASE_URL?.trim()) return "postgres";
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production: orders and payments are stored in Postgres.");
  }
  return "file";
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function matches<T>(config: CollectionConfig<T>, doc: T, filter: Record<string, FilterValue>): boolean {
  return Object.entries(filter).every(([key, wanted]) => {
    if (wanted === undefined) return true;
    const field = config.fields[key];
    if (!field) throw new Error(`Unknown filter field "${key}" on ${config.name}.`);
    const actual = field.read(doc);
    const options = typeof wanted === "string" ? [wanted] : wanted;
    if (Array.isArray(actual)) return options.some((value) => actual.includes(value));
    return typeof actual === "string" && options.includes(actual);
  });
}

// ---------------------------------------------------------------------------
// File backend: development and tests only.
// ---------------------------------------------------------------------------

const fileQueues = new Map<string, Promise<unknown>>();

function fileStore<T>(config: CollectionConfig<T>): DocumentStore<T> {
  const dataDir = () =>
    process.env.MF_DATA_DIR ? path.resolve(process.env.MF_DATA_DIR) : path.join(process.cwd(), ".data");
  const file = () => path.join(dataDir(), `${config.name}.json`);

  async function readAll(): Promise<Record<string, T>> {
    try {
      return JSON.parse(await fs.readFile(file(), "utf8")) as Record<string, T>;
    } catch (error) {
      // A missing file is an empty collection; anything else (a corrupt or
      // unreadable file) must fail loudly rather than be overwritten.
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw error;
    }
  }

  async function persist(docs: Record<string, T>) {
    await fs.mkdir(dataDir(), { recursive: true });
    await fs.writeFile(file(), JSON.stringify(docs, null, 2), "utf8");
  }

  function serialize<R>(run: () => Promise<R>): Promise<R> {
    const key = file();
    const next = (fileQueues.get(key) ?? Promise.resolve()).then(run, run);
    fileQueues.set(
      key,
      next.then(
        () => undefined,
        () => undefined
      )
    );
    return next;
  }

  return {
    get: (id) => serialize(async () => {
      const doc = (await readAll())[id];
      return doc ? clone(doc) : null;
    }),
    find: (filter = {}) =>
      serialize(async () => Object.values(await readAll()).filter((doc) => matches(config, doc, filter)).map(clone)),
    insert: (doc) =>
      serialize(async () => {
        const docs = await readAll();
        const id = config.id(doc);
        if (docs[id]) return false;
        for (const key of config.unique ?? []) {
          const value = config.fields[key].read(doc);
          if (typeof value === "string" && Object.values(docs).some((other) => config.fields[key].read(other) === value)) {
            return false;
          }
        }
        docs[id] = clone(doc);
        await persist(docs);
        return true;
      }),
    update: (id, fn) =>
      serialize(async () => {
        const docs = await readAll();
        if (!docs[id]) return null;
        const draft = clone(docs[id]);
        const result = await fn(draft);
        docs[id] = draft;
        await persist(docs);
        return result;
      }),
  };
}

// ---------------------------------------------------------------------------
// Postgres backend.
// ---------------------------------------------------------------------------

function postgresStore<T>(config: CollectionConfig<T>): DocumentStore<T> {
  const { table } = config;

  function where(filter: Record<string, FilterValue>): SQL | undefined {
    const conditions: SQL[] = [];
    for (const [key, wanted] of Object.entries(filter)) {
      if (wanted === undefined) continue;
      const field = config.fields[key];
      if (!field) throw new Error(`Unknown filter field "${key}" on ${config.name}.`);
      const options = typeof wanted === "string" ? [wanted] : [...wanted];
      if (options.length === 0) return eq(table.id, "\u0000"); // matches nothing
      const isArrayColumn = field.column.columnType === "PgArray";
      if (isArrayColumn) {
        if (options.length !== 1) throw new Error(`Filter "${key}" accepts one value.`);
        conditions.push(arrayContains(field.column, options));
      } else {
        conditions.push(options.length === 1 ? eq(field.column, options[0]) : inArray(field.column, options));
      }
    }
    return conditions.length ? and(...conditions) : undefined;
  }

  function row(doc: T) {
    return { ...config.columns(doc), id: config.id(doc), data: doc };
  }

  return {
    async get(id) {
      const { db } = await getDatabase();
      const [found] = await db.select({ data: table.data }).from(table).where(eq(table.id, id)).limit(1);
      return found ? (found.data as T) : null;
    },
    async find(filter = {}) {
      const { db } = await getDatabase();
      const rows = await db.select({ data: table.data }).from(table).where(where(filter));
      return rows.map((found) => found.data as T);
    },
    async insert(doc) {
      const { db } = await getDatabase();
      const inserted = await db
        .insert(table)
        .values(row(doc) as never)
        .onConflictDoNothing()
        .returning({ id: table.id });
      return inserted.length > 0;
    },
    async update(id, fn) {
      const { db } = await getDatabase();
      return db.transaction(async (tx) => {
        const [found] = await tx
          .select({ data: table.data })
          .from(table)
          .where(eq(table.id, id))
          .for("update");
        if (!found) return null;
        const draft = clone(found.data as T);
        const result = await fn(draft);
        await tx
          .update(table)
          .set({ ...row(draft), updatedAt: new Date() } as never)
          .where(eq(table.id, id));
        return result;
      });
    },
  };
}

/** A store for one collection, on whichever backend this environment uses. */
export function documentStore<T>(config: CollectionConfig<T>): DocumentStore<T> {
  const backends: Partial<Record<"postgres" | "file", DocumentStore<T>>> = {};
  const current = () => {
    const kind = storageBackend();
    return (backends[kind] ??= kind === "postgres" ? postgresStore(config) : fileStore(config));
  };
  return {
    get: (id) => current().get(id),
    find: (filter) => current().find(filter),
    insert: (doc) => current().insert(doc),
    update: (id, fn) => current().update(id, fn),
  };
}
