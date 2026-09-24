import { getEmployeeStore } from './employeeStore';

export interface AnalyzerEmployee {
  id: number;
  empId: string;
  employeeName: string;
  sortOrder: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AnalyzerMapping {
  id: number;
  empId: string;
  employeeName: string;
  aliases: string[];
  createdAt?: string;
  updatedAt?: string;
}

export async function getActiveEmployees(): Promise<AnalyzerEmployee[]> {
  return (await getEmployeeStore()).listEmployees();
}

export async function getActiveEmployeeNames(): Promise<string[]> {
  return (await getActiveEmployees()).map(employee => employee.employeeName);
}

export async function getNameMappings(): Promise<AnalyzerMapping[]> {
  return (await getEmployeeStore()).listMappings();
}
