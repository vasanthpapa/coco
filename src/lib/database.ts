import { MongoClient, type Db } from 'mongodb';
import { DataError } from './dataErrors';
import { initializeMongoSchema } from './mongoSchema';

interface Connection { client: MongoClient; database: Db }
const cache = globalThis as typeof globalThis & { cocoMongo?: Promise<Connection> };

// Lazy, pooled connection: builds do not need credentials or network access.
export async function getDatabase(): Promise<Connection> {
  if (!cache.cocoMongo) {
    const uri = process.env.MONGODB_URI?.trim();
    const name = process.env.MONGODB_DB?.trim() || 'coco';
    if (!uri || !/^mongodb(?:\+srv)?:\/\//.test(uri)) {
      throw new DataError('Configure MONGODB_URI in the server environment and redeploy.', 503);
    }
    cache.cocoMongo = (async () => {
      let client: MongoClient | undefined;
      try {
        client = new MongoClient(uri, {
          maxPoolSize: 10,
          maxIdleTimeMS: 60000,
          serverSelectionTimeoutMS: 10000,
          connectTimeoutMS: 10000,
        });
        await client.connect();
        const database = client.db(name);
        await initializeMongoSchema(database);
        return { client, database };
      } catch {
        await client?.close().catch(() => undefined);
        throw new DataError('Unable to connect to MongoDB. Check credentials, database permissions, and Atlas network access.', 503);
      }
    })().catch(error => {
      cache.cocoMongo = undefined;
      throw error;
    });
  }
  return cache.cocoMongo;
}
