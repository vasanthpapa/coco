import type { Db } from 'mongodb';

export interface EmployeeDocument {
  id: number;
  empId: string;
  employeeName: string;
  nameKey: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MappingDocument {
  id: number;
  employeeId: number;
  empId: string;
  employeeName: string;
  aliases: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CounterDocument { _id: string; value: number }

export async function initializeMongoSchema(database: Db): Promise<void> {
  await database.collection<EmployeeDocument>('employees').createIndexes([
    { key: { id: 1 }, unique: true },
    { key: { empId: 1 }, unique: true },
    { key: { nameKey: 1 }, unique: true },
    { key: { active: 1, sortOrder: 1, nameKey: 1 } },
  ]);
  await database.collection<MappingDocument>('name_mappings').createIndexes([
    { key: { id: 1 }, unique: true },
    { key: { employeeId: 1 }, unique: true },
  ]);
  // Seed numeric IDs before transactions, including after an import.
  for (const name of ['employees', 'name_mappings']) {
    const last = await database.collection(name).findOne({}, { sort: { id: -1 } });
    await database.collection<CounterDocument>('counters').updateOne(
      { _id: name }, { $max: { value: Number(last?.id || 0) } }, { upsert: true }
    );
  }
}
