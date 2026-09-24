import { createClient, type Client, type InValue, type Transaction } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { initializeSchema } from './databaseSchema';

// Connect lazily so API error handlers can catch configuration failures.
let client: Client | undefined;
let ready: Promise<void> | undefined;

function getClient(): Client {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (process.env.VERCEL && (!url || !authToken || !/^(libsql|https):\/\//.test(url))) {
    throw new Error('Configure TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Vercel and redeploy.');
  }
  if (url) {
    client = createClient({ url, authToken, intMode: 'number' });
  } else {
    const file = resolve(process.env.LOCAL_DATABASE_PATH || 'data/coco.db');
    mkdirSync(dirname(file), { recursive: true });
    client = createClient({ url: pathToFileURL(file).href, intMode: 'number' });
  }
  return client;
}

export class DatabaseSession {
  constructor(private readonly executor: Pick<Client | Transaction, 'execute'>) {}

  prepare(sql: string) {
    const execute = (args: InValue[]) => this.executor.execute({ sql, args });
    return {
      all: async (...args: InValue[]): Promise<unknown[]> => (await execute(args)).rows,
      get: async (...args: InValue[]): Promise<unknown> => (await execute(args)).rows[0],
      run: async (...args: InValue[]) => {
        const result = await execute(args);
        return { changes: result.rowsAffected, lastInsertRowid: result.lastInsertRowid ?? null };
      },
    };
  }

  async exec(sql: string): Promise<void> {
    await this.executor.execute(sql);
  }
}

async function ensureReady(): Promise<Client> {
  const connection = getClient();
  if (!ready) {
    ready = (async () => {
      const tx = await connection.transaction('write');
      try {
        await initializeSchema(new DatabaseSession(tx));
        await tx.commit();
      } catch (error) {
        await tx.rollback();
        throw error;
      } finally {
        tx.close();
      }
    })().catch(error => {
      ready = undefined;
      throw error;
    });
  }
  await ready;
  return connection;
}

const db = {
  prepare(sql: string) {
    const session = async () => new DatabaseSession(await ensureReady());
    return {
      all: async (...args: InValue[]) => (await session()).prepare(sql).all(...args),
      get: async (...args: InValue[]) => (await session()).prepare(sql).get(...args),
      run: async (...args: InValue[]) => (await session()).prepare(sql).run(...args),
    };
  },
  transaction<T>(callback: (session: DatabaseSession) => Promise<T>) {
    return async (): Promise<T> => {
      const connection = await ensureReady();
      const tx = await connection.transaction('write');
      try {
        const result = await callback(new DatabaseSession(tx));
        await tx.commit();
        return result;
      } catch (error) {
        await tx.rollback();
        throw error;
      } finally {
        tx.close();
      }
    };
  },
};

export default db;
