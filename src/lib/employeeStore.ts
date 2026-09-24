import type { ClientSession, Db, MongoClient } from 'mongodb';
import { getDatabase } from './database';
import { DataError, numericId, requiredText } from './dataErrors';
import type { CounterDocument, EmployeeDocument, MappingDocument } from './mongoSchema';

export function publicEmployee(row: EmployeeDocument) {
  return {
    id: row.id, empId: row.empId, employeeName: row.employeeName,
    sortOrder: row.sortOrder, active: row.active,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}
export function publicMapping(row: MappingDocument) {
  return {
    id: row.id, empId: row.empId, employeeName: row.employeeName,
    aliases: row.aliases, createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

export class EmployeeStore {
  constructor(private readonly client: MongoClient, private readonly database: Db) {}
  private get employees() { return this.database.collection<EmployeeDocument>('employees'); }
  private get mappings() { return this.database.collection<MappingDocument>('name_mappings'); }

  private async transaction<T>(operation: (session: ClientSession) => Promise<T>): Promise<T> {
    return this.client.withSession(session => session.withTransaction(() => operation(session), {
      readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary',
    }));
  }

  private async nextId(name: string, session: ClientSession): Promise<number> {
    const counter = await this.database.collection<CounterDocument>('counters').findOneAndUpdate(
      { _id: name }, { $inc: { value: 1 } }, { session, returnDocument: 'after' }
    );
    if (!counter || !Number.isSafeInteger(counter.value)) throw new Error('Invalid ID counter.');
    return counter.value;
  }

  private identity(empId: unknown, employeeName: unknown) {
    const name = requiredText(employeeName, 'Employee name');
    return { empId: requiredText(empId, 'Employee ID').toUpperCase(), employeeName: name, nameKey: name.toLowerCase() };
  }

  async listEmployees() {
    const rows = await this.employees.find({ active: true }).sort({ sortOrder: 1, nameKey: 1 }).toArray();
    return rows.map(publicEmployee);
  }

  async createEmployee(empId: unknown, employeeName: unknown) {
    const identity = this.identity(empId, employeeName);
    return this.transaction(async session => {
      const id = await this.nextId('employees', session);
      const last = await this.employees.findOne({}, { session, sort: { sortOrder: -1 } });
      const now = new Date().toISOString();
      const employee: EmployeeDocument = {
        id, ...identity, sortOrder: (last?.sortOrder ?? -1) + 1,
        active: true, createdAt: now, updatedAt: now,
      };
      await this.employees.insertOne(employee, { session });
      return publicEmployee(employee);
    });
  }

  async updateEmployee(value: unknown, empId: unknown, employeeName: unknown) {
    const id = numericId(value);
    const identity = this.identity(empId, employeeName);
    return this.transaction(async session => {
      const now = new Date().toISOString();
      const employee = await this.employees.findOneAndUpdate(
        { id }, { $set: { ...identity, updatedAt: now } }, { session, returnDocument: 'after' }
      );
      if (!employee) throw new DataError('Employee not found.', 404);
      await this.mappings.updateMany({ employeeId: id }, {
        $set: { empId: identity.empId, employeeName: identity.employeeName, updatedAt: now },
      }, { session });
      return publicEmployee(employee);
    });
  }

  async deleteEmployee(value: unknown) {
    const id = numericId(value);
    return this.transaction(async session => {
      const employee = await this.employees.findOneAndDelete({ id }, { session });
      if (!employee) throw new DataError('Employee not found.', 404);
      await this.mappings.deleteMany({ employeeId: id }, { session });
      return { success: true, message: `"${employee.employeeName}" deleted successfully.` };
    });
  }

  async reorderEmployees(values: unknown) {
    if (!Array.isArray(values) || !values.length) throw new DataError('employeeIds must be a nonempty array.', 400);
    const ids = values.map(numericId);
    if (new Set(ids).size !== ids.length) throw new DataError('employeeIds cannot contain duplicates.', 400);
    return this.transaction(async session => {
      const count = await this.employees.countDocuments({ id: { $in: ids }, active: true }, { session });
      if (count !== ids.length) throw new DataError('One or more employees were not found.', 404);
      const now = new Date().toISOString();
      await this.employees.bulkWrite(ids.map((id, sortOrder) => ({
        updateOne: { filter: { id, active: true }, update: { $set: { sortOrder, updatedAt: now } } },
      })), { session });
      const rows = await this.employees.find({ active: true }, { session }).sort({ sortOrder: 1, nameKey: 1 }).toArray();
      return { success: true, employees: rows.map(publicEmployee) };
    });
  }

  async listMappings() {
    const rows = await this.mappings.find({}).sort({ employeeName: 1 }).collation({ locale: 'en', strength: 2 }).toArray();
    return rows.map(publicMapping);
  }

  // Take a write lock on the employee in mapping transactions. A concurrent
  // rename/delete must conflict and retry instead of leaving an orphan mapping.
  private async mappingEmployee(name: unknown, session: ClientSession, activeOnly = true) {
    const employeeName = requiredText(name, 'Employee name');
    const employee = await this.employees.findOneAndUpdate(
      { nameKey: employeeName.toLowerCase(), ...(activeOnly ? { active: true } : {}) },
      { $inc: { mappingRevision: 1 } }, { session, returnDocument: 'after' }
    );
    if (!employee) throw new DataError(`"${employeeName}" is not a valid employee.`, 404);
    return employee;
  }

  async addAlias(name: unknown, value: unknown) {
    const alias = requiredText(value, 'Alias');
    return this.transaction(async session => {
      const employee = await this.mappingEmployee(name, session);
      const existing = await this.mappings.findOne({ employeeId: employee.id }, { session });
      if (existing?.aliases.some(item => item.toLowerCase() === alias.toLowerCase())) {
        throw new DataError(`"${alias}" is already mapped.`, 409);
      }
      const now = new Date().toISOString();
      if (existing) {
        const mapping = await this.mappings.findOneAndUpdate(
          { id: existing.id }, { $push: { aliases: alias }, $set: { updatedAt: now } },
          { session, returnDocument: 'after' }
        );
        return { mapping: publicMapping(mapping!), created: false };
      }
      const mapping: MappingDocument = {
        id: await this.nextId('name_mappings', session), employeeId: employee.id,
        empId: employee.empId, employeeName: employee.employeeName, aliases: [alias],
        createdAt: now, updatedAt: now,
      };
      await this.mappings.insertOne(mapping, { session });
      return { mapping: publicMapping(mapping), created: true };
    });
  }

  async updateMapping(value: unknown, name: unknown, values: unknown) {
    const id = numericId(value);
    const aliases = Array.isArray(values) ? values.map(String).map(item => item.trim()).filter(Boolean) : [];
    if (new Set(aliases.map(item => item.toLowerCase())).size !== aliases.length) {
      throw new DataError('Duplicate aliases are not allowed.', 409);
    }
    return this.transaction(async session => {
      const employee = await this.mappingEmployee(name, session);
      const mapping = await this.mappings.findOneAndUpdate({ id }, { $set: {
        employeeId: employee.id, empId: employee.empId, employeeName: employee.employeeName,
        aliases, updatedAt: new Date().toISOString(),
      } }, { session, returnDocument: 'after' });
      if (!mapping) throw new DataError('Mapping not found.', 404);
      return publicMapping(mapping);
    });
  }

  async removeAlias(value: unknown, aliasValue: unknown) {
    const id = numericId(value);
    const alias = requiredText(aliasValue, 'Alias');
    return this.transaction(async session => {
      const existing = await this.mappings.findOne({ id }, { session });
      if (!existing) throw new DataError('Mapping not found.', 404);
      const aliases = existing.aliases.filter(item => item.toLowerCase() !== alias.toLowerCase());
      if (aliases.length === existing.aliases.length) throw new DataError(`"${alias}" is not mapped.`, 404);
      const mapping = await this.mappings.findOneAndUpdate({ id }, {
        $set: { aliases, updatedAt: new Date().toISOString() },
      }, { session, returnDocument: 'after' });
      return { success: true, ...publicMapping(mapping!) };
    });
  }

  async deleteMappingByEmployee(name: unknown) {
    return this.transaction(async session => {
      const employee = await this.mappingEmployee(name, session, false);
      const result = await this.mappings.deleteOne({ employeeId: employee.id }, { session });
      return { success: true, deleted: result.deletedCount > 0, empId: employee.empId, employeeName: employee.employeeName };
    });
  }

  async clearMappings() {
    return this.transaction(async session => {
      await this.mappings.deleteMany({}, { session });
      return { success: true, message: 'All employee mappings cleared successfully.' };
    });
  }
}

export async function getEmployeeStore(): Promise<EmployeeStore> {
  const { client, database } = await getDatabase();
  return new EmployeeStore(client, database);
}
