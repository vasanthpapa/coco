'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Save,
  Trash2,
  UsersRound,
  Search,
  Plus,
  X,
  UserPlus,
  Pencil,
} from 'lucide-react';

import ConfirmModal from './ConfirmModal';

import {
  addEmployee,
  deleteEmployee,
  updateEmployee,
  loadEmployeeRecords,
  loadEmployeeNameMappings,
  saveEmployeeNameMapping,
  removeEmployeeNameMapping,
  updateEmployeeNameMapping,
  deleteEmployeeNameMapping,
  type NameMapping,
  type EmployeeRecord,
} from '../utils/employeeApi';

interface EmployeeMappingProps {
  analyzedNames?: string[];
}

export default function EmployeeMapping({
  analyzedNames = [],
}: EmployeeMappingProps) {
  const [savedName, setSavedName] = useState('');
  const [officialEmpId, setOfficialEmpId] = useState('');

  const [employeeRecords, setEmployeeRecords] =
    useState<EmployeeRecord[]>([]);

  const [mappings, setMappings] =
    useState<NameMapping[]>([]);

  const employees = employeeRecords;

  const availableAnalyzedNames = useMemo(() => {
    const mappedNames = new Set(
      mappings.flatMap(mapping =>
        mapping.aliases.map(alias =>
          alias.trim().toLowerCase()
        )
      )
    );

    const uniqueNames = new Map<string, string>();

    analyzedNames.forEach(name => {
      const cleanName = String(name || '').trim();

      if (!cleanName) {
        return;
      }

      const key = cleanName.toLowerCase();

      if (
        !mappedNames.has(key) &&
        !uniqueNames.has(key)
      ) {
        uniqueNames.set(key, cleanName);
      }
    });

    return Array.from(uniqueNames.values()).sort((a, b) =>
      a.localeCompare(b, undefined, {
        sensitivity: 'base',
      })
    );
  }, [analyzedNames, mappings]);

  const [editingEmployeeId, setEditingEmployeeId] =
    useState<number | null>(null);
const [newEmployeeEmpId, setNewEmployeeEmpId] = useState('');
  const [editingEmployeeEmpId, setEditingEmployeeEmpId] =
    useState('');

  const [editingOriginalEmployeeEmpId, setEditingOriginalEmployeeEmpId] =
    useState('');

  const [editingEmployeeName, setEditingEmployeeName] =
    useState('');

  const [editingOriginalEmployeeName, setEditingOriginalEmployeeName] =
    useState('');

  const [search, setSearch] = useState('');
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState('');

  // empId is the stable identity used for mapping/editing state.
  const [editingEmployee, setEditingEmployee] =
    useState<string | null>(null);

  const [editingMappingId, setEditingMappingId] =
    useState<number | null>(null);

  const [editingSavedName, setEditingSavedName] =
    useState('');

  const [editingOriginalSavedName, setEditingOriginalSavedName] =
    useState('');

  const [isAddingMapping, setIsAddingMapping] =
    useState(false);

  const [confirmDeleteMapping, setConfirmDeleteMapping] =
    useState(false);

  const [deleteTarget, setDeleteTarget] = useState('');

  const [confirmDeleteEmployee, setConfirmDeleteEmployee] =
    useState(false);

  // Stores empId, not employee name.
  const [deleteEmployeeTarget, setDeleteEmployeeTarget] =
    useState('');

  const [successMessage, setSuccessMessage] =
    useState('');

  const [errorMessage, setErrorMessage] =
    useState('');

  const [isSaving, setIsSaving] =
    useState(false);

  const [isAddingEmployee, setIsAddingEmployee] =
    useState(false);

  const loadData = async () => {
    try {
      const [employeeData, mappingData] =
        await Promise.all([
          loadEmployeeRecords(),
          loadEmployeeNameMappings(),
        ]);

      setEmployeeRecords(employeeData);
      setMappings(mappingData);

      return {
        employeeData,
        mappingData,
      };
    } catch (error) {
      console.error(
        'Failed to load employee data:',
        error
      );

      setEmployeeRecords([]);
      setMappings([]);

      return {
        employeeData: [],
        mappingData: [],
      };
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const notifyMappingUpdated = () => {
    window.dispatchEvent(
      new Event('employee-mapping-updated')
    );
  };

  const clearMessages = () => {
    setSuccessMessage('');
    setErrorMessage('');
  };

  const showSuccess = (message: string) => {
    setErrorMessage('');
    setSuccessMessage(message);

    window.setTimeout(() => {
      setSuccessMessage('');
    }, 2500);
  };

  const showError = (message: string) => {
    setSuccessMessage('');
    setErrorMessage(message);

    window.setTimeout(() => {
      setErrorMessage('');
    }, 4000);
  };

  const getAllMappedSavedNames = (
    empId: string
  ): string[] => {
    const mapping = mappings.find(
      item => item.empId === empId
    );

    return mapping?.aliases ?? [];
  };

  const handleAddEmployee = async () => {
    if (isAddingEmployee) {
      return;
    }

    clearMessages();
const cleanEmpId =
  newEmployeeEmpId.trim().toUpperCase();
const duplicateEmpId = employees.some(
  employee =>
    employee.empId.trim().toLowerCase() ===
    cleanEmpId.toLowerCase()
);

if (duplicateEmpId) {
  showError(
    `"${cleanEmpId}" already exists in the employee list.`
  );
  return;
}
if (!cleanEmpId) {
  showError('Please enter an employee ID.');
  return;
}
    const cleanName =
      newEmployeeName.trim();

    if (!cleanName) {
      showError(
        'Please enter an employee name.'
      );
      return;
    }

    const alreadyExists = employees.some(
      employee =>
        employee.employeeName.trim().toLowerCase() ===
        cleanName.toLowerCase()
    );

    if (alreadyExists) {
      showError(
        `"${cleanName}" already exists in the employee list.`
      );
      return;
    }

    try {
      setIsAddingEmployee(true);

      const added = await addEmployee(
  cleanEmpId,
  cleanName
);

      if (!added) {
        throw new Error(
          `"${cleanName}" could not be added.`
        );
      }

      const {
        employeeData,
      } = await loadData();

      notifyMappingUpdated();

      const addedEmployee = employeeData.find(
        employee =>
          employee.employeeName.trim().toLowerCase() ===
          cleanName.toLowerCase()
      );

      if (addedEmployee) {
        setOfficialEmpId(
          addedEmployee.empId
        );
      }

      setNewEmployeeEmpId('');
setNewEmployeeName('');
setShowAddEmployee(false);

      showSuccess(
        `${cleanName} added successfully.`
      );
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : 'Failed to add employee.'
      );
    } finally {
      setIsAddingEmployee(false);
    }
  };

  const handleSaveMapping = async () => {
    if (isSaving) {
      return;
    }

    clearMessages();

    const cleanSavedName =
      savedName.trim();

    if (!cleanSavedName) {
      showError(
        'Please select an analyzed WhatsApp name.'
      );
      return;
    }

    if (!officialEmpId) {
      showError(
        'Please select an official employee.'
      );
      return;
    }

    const selectedEmployee =
      employeeRecords.find(
        employee =>
          employee.empId === officialEmpId
      );

    if (!selectedEmployee) {
      showError(
        'Please select a valid official employee.'
      );
      return;
    }

    const cleanOfficialName =
      selectedEmployee.employeeName.trim();

    const duplicateMapping =
      mappings.find(mapping =>
        mapping.aliases.some(
          alias =>
            alias.trim().toLowerCase() ===
            cleanSavedName.toLowerCase()
        )
      );

    if (duplicateMapping) {
      showError(
        `"${cleanSavedName}" is already mapped to "${duplicateMapping.employeeName}".`
      );
      return;
    }

    try {
      setIsSaving(true);

      await saveEmployeeNameMapping(
        cleanSavedName,
        cleanOfficialName
      );

      await loadData();

      notifyMappingUpdated();

      setSavedName('');
      setOfficialEmpId('');

      showSuccess(
        `"${cleanSavedName}" mapped to "${cleanOfficialName}" successfully.`
      );
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : 'Failed to save mapping.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const startAddMapping = (
    employee: EmployeeRecord
  ) => {
    clearMessages();

    setEditingEmployee(employee.empId);
    setEditingMappingId(null);
    setEditingSavedName('');
    setEditingOriginalSavedName('');
    setIsAddingMapping(true);
  };

  const startEditMapping = (
    employee: EmployeeRecord,
    savedNameToEdit: string
  ) => {
    clearMessages();

    const mapping = mappings.find(
      item =>
        item.empId === employee.empId &&
        item.aliases.some(
          alias =>
            alias.trim().toLowerCase() ===
            savedNameToEdit.trim().toLowerCase()
        )
    );

    if (!mapping) {
      showError('Mapping could not be found.');
      return;
    }

    setEditingEmployee(employee.empId);
    setEditingMappingId(mapping.id);
    setEditingSavedName(savedNameToEdit);
    setEditingOriginalSavedName(savedNameToEdit);
    setIsAddingMapping(false);
  };

  const cancelEditMapping = () => {
    setEditingEmployee(null);
    setEditingMappingId(null);
    setEditingSavedName('');
    setEditingOriginalSavedName('');
    setIsAddingMapping(false);
    clearMessages();
  };

  const handleInlineSave = async () => {
    if (isSaving) {
      return;
    }

    clearMessages();

    if (!editingEmployee) {
      showError(
        'Employee could not be identified.'
      );
      return;
    }

    const cleanSavedName =
      editingSavedName.trim();

    const employeeRecord =
      employeeRecords.find(
        employee =>
          employee.empId === editingEmployee
      );

    if (!employeeRecord) {
      showError(
        'Employee could not be found.'
      );
      return;
    }

    const cleanOfficialName =
      employeeRecord.employeeName.trim();

    if (!cleanSavedName) {
      showError(
        'Please enter a WhatsApp saved name.'
      );
      return;
    }

    const duplicateMapping =
      mappings.find(mapping =>
        mapping.aliases.some(alias => {
          const sameAlias =
            alias.trim().toLowerCase() ===
            cleanSavedName.toLowerCase();

          if (!sameAlias) {
            return false;
          }

          if (
            !isAddingMapping &&
            mapping.id === editingMappingId &&
            alias.trim().toLowerCase() ===
              editingOriginalSavedName
                .trim()
                .toLowerCase()
          ) {
            return false;
          }

          return true;
        })
      );

    if (duplicateMapping) {
      showError(
        `"${cleanSavedName}" is already mapped to "${duplicateMapping.employeeName}".`
      );
      return;
    }

    try {
      setIsSaving(true);

      if (isAddingMapping) {
        await saveEmployeeNameMapping(
          cleanSavedName,
          cleanOfficialName
        );
      } else {
        const mapping = mappings.find(
          item =>
            item.id === editingMappingId
        );

        if (!mapping) {
          throw new Error(
            'Mapping could not be found.'
          );
        }

        const updatedAliases =
          mapping.aliases.map(alias =>
            alias.trim().toLowerCase() ===
            editingOriginalSavedName
              .trim()
              .toLowerCase()
              ? cleanSavedName
              : alias
          );

        await updateEmployeeNameMapping(
          mapping.id,
          mapping.employeeName,
          updatedAliases
        );
      }

      await loadData();

      const wasAdding =
        isAddingMapping;

      cancelEditMapping();

      notifyMappingUpdated();

      showSuccess(
        wasAdding
          ? `"${cleanSavedName}" mapped to "${cleanOfficialName}" successfully.`
          : `"${cleanSavedName}" updated successfully.`
      );
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : 'Failed to save mapping.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const requestDeleteMapping = (
    savedNameToDelete: string
  ) => {
    clearMessages();

    setDeleteTarget(
      savedNameToDelete
    );

    setConfirmDeleteMapping(true);
  };

  const requestDeleteEmployee = (
    employee: EmployeeRecord
  ) => {
    clearMessages();

    setDeleteEmployeeTarget(
      employee.empId
    );

    setConfirmDeleteEmployee(true);
  };

  const startEditEmployee = (
    employee: EmployeeRecord
  ) => {
    clearMessages();

    setEditingEmployeeId(employee.id);

    setEditingEmployeeEmpId(
      employee.empId
    );

    setEditingOriginalEmployeeEmpId(
      employee.empId
    );

    setEditingEmployeeName(
      employee.employeeName
    );

    setEditingOriginalEmployeeName(
      employee.employeeName
    );
  };

  const cancelEditEmployee = () => {
    setEditingEmployeeId(null);
    setEditingEmployeeEmpId('');
    setEditingOriginalEmployeeEmpId('');
    setEditingEmployeeName('');
    setEditingOriginalEmployeeName('');
    clearMessages();
  };

  const handleSaveEmployee = async () => {
    if (isSaving) {
      return;
    }

    clearMessages();

    if (editingEmployeeId === null) {
      showError(
        'Employee could not be identified.'
      );
      return;
    }

    const cleanNewEmpId =
      editingEmployeeEmpId
        .trim()
        .toUpperCase();

    const cleanOriginalEmpId =
      editingOriginalEmployeeEmpId
        .trim()
        .toUpperCase();

    const cleanNewName =
      editingEmployeeName.trim();

    const cleanOldName =
      editingOriginalEmployeeName.trim();

    if (!cleanNewEmpId) {
      showError(
        'Employee ID cannot be empty.'
      );
      return;
    }

    if (!cleanNewName) {
      showError(
        'Employee name cannot be empty.'
      );
      return;
    }

    if (
      cleanNewEmpId === cleanOriginalEmpId &&
      cleanNewName.toLowerCase() ===
        cleanOldName.toLowerCase()
    ) {
      cancelEditEmployee();
      return;
    }

    const duplicateEmpId =
      employeeRecords.find(
        employee =>
          employee.id !== editingEmployeeId &&
          employee.empId.trim().toLowerCase() ===
            cleanNewEmpId.toLowerCase()
      );

    if (duplicateEmpId) {
      showError(
        `"${cleanNewEmpId}" already exists in the employee list.`
      );
      return;
    }

    const duplicateEmployee =
      employeeRecords.find(
        employee =>
          employee.id !== editingEmployeeId &&
          employee.employeeName
            .trim()
            .toLowerCase() ===
            cleanNewName.toLowerCase()
      );

    if (duplicateEmployee) {
      showError(
        `"${cleanNewName}" already exists in the employee list.`
      );
      return;
    }

    try {
      setIsSaving(true);

      const updated =
        await updateEmployee(
          editingEmployeeId,
          cleanNewEmpId,
          cleanNewName
        );

      if (!updated) {
        throw new Error(
          `"${cleanOldName}" could not be updated.`
        );
      }

      await loadData();

      // If this employee is currently selected
      // in the mapping dropdown, keep the selection.
      if (
        officialEmpId ===
        cleanOriginalEmpId
      ) {
        setOfficialEmpId(
          cleanNewEmpId
        );
      }

      // If a mapping edit is active for this
      // employee, move its editing identity too.
      if (
        editingEmployee ===
        cleanOriginalEmpId
      ) {
        setEditingEmployee(
          cleanNewEmpId
        );
      }

      cancelEditEmployee();

      notifyMappingUpdated();

      showSuccess(
        `"${cleanOriginalEmpId}" / "${cleanOldName}" updated to "${cleanNewEmpId}" / "${cleanNewName}" successfully.`
      );
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : 'Failed to update employee.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDeleteEmployee =
    async () => {
      if (!deleteEmployeeTarget) {
        return;
      }

      const employeeToDelete =
        deleteEmployeeTarget;

      const employeeRecord =
        employeeRecords.find(
          employee =>
            employee.empId ===
            employeeToDelete
        );

      if (!employeeRecord) {
        showError(
          `"${employeeToDelete}" could not be found.`
        );
        return;
      }

      const employeeName =
        employeeRecord.employeeName;

      try {
        await deleteEmployeeNameMapping(
          employeeName
        );

        const deleted =
          await deleteEmployee(
            employeeRecord.id
          );

        if (!deleted) {
          throw new Error(
            `"${employeeName}" could not be deleted.`
          );
        }

        setEmployeeRecords(prev =>
          prev.filter(
            employee =>
              employee.empId !==
              employeeRecord.empId
          )
        );

        setMappings(prev =>
          prev.filter(
            mapping =>
              mapping.empId !==
              employeeRecord.empId
          )
        );

        setDeleteEmployeeTarget('');
        setConfirmDeleteEmployee(false);

        if (
          editingEmployee ===
          employeeToDelete
        ) {
          cancelEditMapping();
        }

        if (
          officialEmpId ===
          employeeToDelete
        ) {
          setOfficialEmpId('');
        }

        if (
          editingEmployeeId ===
          employeeRecord.id
        ) {
          cancelEditEmployee();
        }

        notifyMappingUpdated();

        showSuccess(
          `"${employeeName}" and all associated mappings were deleted successfully.`
        );
      } catch (error) {
        showError(
          error instanceof Error
            ? error.message
            : 'Failed to delete employee.'
        );
      }
    };

  const handleConfirmDeleteMapping =
    async () => {
      if (!deleteTarget) {
        return;
      }

      const target = deleteTarget;

      const mapping = mappings.find(
        item =>
          item.aliases.some(
            alias =>
              alias.trim().toLowerCase() ===
              target.trim().toLowerCase()
          )
      );

      if (!mapping) {
        showError(
          `Mapping "${target}" could not be found.`
        );
        return;
      }

      try {
        await removeEmployeeNameMapping(
          mapping.id,
          target
        );

        setMappings(prev =>
          prev
            .map(item =>
              item.id === mapping.id
                ? {
                    ...item,
                    aliases:
                      item.aliases.filter(
                        alias =>
                          alias.trim().toLowerCase() !==
                          target.trim().toLowerCase()
                      ),
                  }
                : item
            )
            .filter(
              item =>
                item.aliases.length > 0
            )
        );

        if (
          editingOriginalSavedName
            .trim()
            .toLowerCase() ===
          target.trim().toLowerCase()
        ) {
          cancelEditMapping();
        }

        if (
          savedName
            .trim()
            .toLowerCase() ===
          target.trim().toLowerCase()
        ) {
          setSavedName('');
        }

        setDeleteTarget('');
        setConfirmDeleteMapping(false);

        notifyMappingUpdated();

        showSuccess(
          `"${target}" deleted successfully.`
        );
      } catch (error) {
        showError(
          error instanceof Error
            ? error.message
            : 'Failed to delete mapping.'
        );
      }
    };

const filteredEmployees = employees
  .filter(employee => {
    const mappedNames = getAllMappedSavedNames(
      employee.empId
    );

    const query = search.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return (
      employee.employeeName
        .toLowerCase()
        .includes(query) ||
      employee.empId
        .toLowerCase()
        .includes(query) ||
      mappedNames.some(name =>
        name.toLowerCase().includes(query)
      )
    );
  })
  .sort((a, b) =>
    a.empId.localeCompare(
      b.empId,
      undefined,
      {
        numeric: true,
        sensitivity: 'base',
      }
    )
  );

  return (
    <>
      <div className="w-full">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-xl">
              <UsersRound className="w-7 h-7 text-primary" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white">
                Employee Mapping
              </h2>

              <p className="text-sm text-slate-400 mt-1">
                Map multiple WhatsApp saved names to official employees
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-400">
              {employees.length} employees
            </div>

            <div className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-400">
              {mappings.length} mapped employees
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-8 shadow-xl">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 rounded-lg bg-primary/10">
              <UserPlus className="w-4 h-4 text-primary" />
            </div>

            <div>
              <h3 className="text-base font-semibold text-white">
                Add Employee Mapping
              </h3>

              <p className="text-xs text-slate-500 mt-0.5">
                Connect a WhatsApp contact name with an official employee
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto] gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                WhatsApp Saved Name
              </label>

              <select
                value={savedName}
                onChange={e =>
                  setSavedName(
                    e.target.value
                  )
                }
                disabled={
                  isSaving ||
                  availableAnalyzedNames.length === 0
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">
                  {availableAnalyzedNames.length > 0
                    ? 'Select analyzed name'
                    : analyzedNames.length > 0
                      ? 'All analyzed names are mapped'
                      : 'Analyze WhatsApp data first'}
                </option>

                {availableAnalyzedNames.map(name => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              <p className="mt-1.5 text-xs text-slate-500">
                Names detected from the current WhatsApp analysis
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Official Employee
              </label>

              <div className="flex gap-2">
                <select
                  value={officialEmpId}
                  onChange={e =>
                    setOfficialEmpId(
                      e.target.value
                    )
                  }
                  className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition"
                >
                  <option value="">
                    Select employee
                  </option>

                  {employees.map(employee => (
                    <option
                      key={employee.empId}
                      value={employee.empId}
                    >
                      {employee.empId} — {employee.employeeName}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() =>
                    setShowAddEmployee(
                      prev => !prev
                    )
                  }
                  className={`flex-shrink-0 px-3 rounded-xl border transition ${
                    showAddEmployee
                      ? 'bg-slate-700 border-slate-600 text-white'
                      : 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/20'
                  }`}
                  title="Add employee"
                >
                  {showAddEmployee ? (
                    <X className="w-5 h-5" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Plus className="w-5 h-5" />

                      <span className="text-sm font-medium">
                        Add employee
                      </span>
                    </div>
                  )}
                </button>
              </div>

              {showAddEmployee && (
  <div className="mt-3 flex gap-2">
    <input
      type="text"
      value={newEmployeeEmpId}
      onChange={e =>
        setNewEmployeeEmpId(
          e.target.value.toUpperCase()
        )
      }
      onKeyDown={e => {
        if (e.key === 'Enter') {
          handleAddEmployee();
        }
      }}
      autoFocus
      placeholder="Employee ID"
      className="w-32 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-primary placeholder:text-slate-500 focus:outline-none focus:border-primary"
    />

    <input
      type="text"
      value={newEmployeeName}
      onChange={e =>
        setNewEmployeeName(
          e.target.value
        )
      }
      onKeyDown={e => {
        if (e.key === 'Enter') {
          handleAddEmployee();
        }
      }}
      placeholder="Employee name"
      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary"
    />

    <button
      type="button"
      onClick={handleAddEmployee}
      disabled={
        isAddingEmployee ||
        !newEmployeeEmpId.trim() ||
        !newEmployeeName.trim()
      }
      className="px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
    >
      {isAddingEmployee
        ? 'Adding...'
        : 'Add'}
    </button>
  </div>
)}
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={
                  handleSaveMapping
                }
                disabled={
                  isSaving ||
                  !savedName.trim() ||
                  !officialEmpId
                }
                className="w-full lg:w-auto px-6 py-3 rounded-xl bg-primary text-white font-medium flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg shadow-primary/10"
              >
                <Save className="w-4 h-4" />

                {isSaving
                  ? 'Saving...'
                  : 'Save Mapping'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-slate-700">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h3 className="font-semibold text-white">
                  Existing Mappings
                </h3>

                <p className="text-xs text-slate-500 mt-1">
                  Each employee can have multiple WhatsApp saved names
                </p>
              </div>

              <div className="relative w-full lg:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

                <input
                  type="text"
                  value={search}
                  onChange={e =>
                    setSearch(
                      e.target.value
                    )
                  }
                  placeholder="Search employee or mapping..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary transition"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/40">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Official Employee
                  </th>

                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    WhatsApp Saved Name
                  </th>

                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800">
                {filteredEmployees.length ===
                0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-5 py-12 text-center"
                    >
                      <UsersRound className="w-10 h-10 text-slate-600 mx-auto mb-3" />

                      <p className="text-sm text-slate-500">
                        No employees found.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map(
                    employee => {
                      const mappedSavedNames =
                        getAllMappedSavedNames(
                          employee.empId
                        );

                      const isEditing =
                        editingEmployee ===
                        employee.empId;

                      if (isEditing) {
                        return (
                          <tr
                            key={employee.empId}
                            className="bg-primary/[0.03]"
                          >
                            <td className="px-5 py-4">
                              <div className="flex flex-col gap-2 min-w-[220px]">
                                <input
                                  type="text"
                                  value={
                                    editingEmployeeEmpId
                                  }
                                  onChange={e =>
                                    setEditingEmployeeEmpId(
                                      e.target.value
                                    )
                                  }
                                  onKeyDown={e => {
                                    if (
                                      e.key ===
                                      'Enter'
                                    ) {
                                      handleSaveEmployee();
                                    }

                                    if (
                                      e.key ===
                                      'Escape'
                                    ) {
                                      cancelEditEmployee();
                                    }
                                  }}
                                  autoFocus
                                  placeholder="Employee ID"
                                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-primary placeholder:text-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                                />

                                <input
                                  type="text"
                                  value={
                                    editingEmployeeName
                                  }
                                  onChange={e =>
                                    setEditingEmployeeName(
                                      e.target.value
                                    )
                                  }
                                  onKeyDown={e => {
                                    if (
                                      e.key ===
                                      'Enter'
                                    ) {
                                      handleSaveEmployee();
                                    }

                                    if (
                                      e.key ===
                                      'Escape'
                                    ) {
                                      cancelEditEmployee();
                                    }
                                  }}
                                  placeholder="Employee name"
                                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                                />
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex flex-wrap gap-2">
                                {mappedSavedNames.length >
                                0 ? (
                                  mappedSavedNames.map(
                                    savedNameItem => (
                                      <span
                                        key={
                                          savedNameItem
                                        }
                                        className="inline-flex items-center rounded-lg bg-primary/10 border border-primary/10 px-2.5 py-1 text-sm text-primary"
                                      >
                                        {
                                          savedNameItem
                                        }
                                      </span>
                                    )
                                  )
                                ) : (
                                  <span className="text-sm text-slate-600 italic">
                                    Not mapped
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="px-5 py-4 align-top">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={
                                    handleSaveEmployee
                                  }
                                  disabled={
                                    isSaving ||
                                    !editingEmployeeEmpId.trim() ||
                                    !editingEmployeeName.trim()
                                  }
                                  className="px-2.5 py-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5"
                                  title="Save employee changes"
                                >
                                  {isSaving ? (
                                    <span className="text-xs font-medium">
                                      Saving...
                                    </span>
                                  ) : (
                                    <>
                                      <Save className="w-4 h-4" />

                                      <span className="text-xs font-medium">
                                        Save
                                      </span>
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={
                                    cancelEditEmployee
                                  }
                                  className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 transition"
                                  title="Cancel"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      const employeeNameMappingIsEditing =
                        editingEmployeeId ===
                        employee.id;

                      return (
                        <tr
                          key={employee.empId}
                          className="hover:bg-slate-800/40 transition"
                        >
                          <td className="px-5 py-4 align-top">
                            {employeeNameMappingIsEditing ? (
                              <div className="flex flex-col gap-2 min-w-[220px]">
                                <input
                                  type="text"
                                  value={
                                    editingEmployeeEmpId
                                  }
                                  onChange={e =>
                                    setEditingEmployeeEmpId(
                                      e.target.value
                                    )
                                  }
                                  onKeyDown={e => {
                                    if (
                                      e.key ===
                                      'Enter'
                                    ) {
                                      handleSaveEmployee();
                                    }

                                    if (
                                      e.key ===
                                      'Escape'
                                    ) {
                                      cancelEditEmployee();
                                    }
                                  }}
                                  autoFocus
                                  placeholder="Employee ID"
                                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-primary placeholder:text-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                                />

                                <input
                                  type="text"
                                  value={
                                    editingEmployeeName
                                  }
                                  onChange={e =>
                                    setEditingEmployeeName(
                                      e.target.value
                                    )
                                  }
                                  onKeyDown={e => {
                                    if (
                                      e.key ===
                                      'Enter'
                                    ) {
                                      handleSaveEmployee();
                                    }

                                    if (
                                      e.key ===
                                      'Escape'
                                    ) {
                                      cancelEditEmployee();
                                    }
                                  }}
                                  placeholder="Employee name"
                                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                                />

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={
                                      handleSaveEmployee
                                    }
                                    disabled={
                                      isSaving ||
                                      !editingEmployeeEmpId.trim() ||
                                      !editingEmployeeName.trim()
                                    }
                                    className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition"
                                    title="Save employee changes"
                                  >
                                    <Save className="w-4 h-4" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={
                                      cancelEditEmployee
                                    }
                                    className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 transition"
                                    title="Cancel"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium text-primary">
                                    {employee.empId}
                                  </span>

                                  <span className="text-sm font-medium text-white">
                                    {employee.employeeName}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    startEditEmployee(
                                      employee
                                    )
                                  }
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-primary hover:bg-primary/10 transition"
                                  title={`Edit ${employee.employeeName}`}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex flex-wrap gap-2">
                              {mappedSavedNames.length >
                              0 ? (
                                mappedSavedNames.map(
                                  savedNameItem => (
                                    <div
                                      key={
                                        savedNameItem
                                      }
                                      className="inline-flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/10 overflow-hidden"
                                    >
                                      <span className="px-2.5 py-1 text-sm text-primary">
                                        {
                                          savedNameItem
                                        }
                                      </span>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          startEditMapping(
                                            employee,
                                            savedNameItem
                                          )
                                        }
                                        className="px-1.5 py-1 text-slate-500 hover:text-primary hover:bg-primary/10 transition"
                                        title={`Edit ${savedNameItem}`}
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          requestDeleteMapping(
                                            savedNameItem
                                          )
                                        }
                                        className="px-1.5 py-1 mr-0.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                                        title={`Delete ${savedNameItem}`}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )
                                )
                              ) : (
                                <span className="text-sm text-slate-600 italic">
                                  Not mapped
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-4 align-top">
                            <div className="flex items-center justify-end">
                              <button
                                type="button"
                                onClick={() =>
                                  startAddMapping(
                                    employee
                                  )
                                }
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 transition"
                                title="Add another mapping"
                              >
                                <Plus className="w-3.5 h-3.5" />

                                Add Mapping
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  requestDeleteEmployee(
                                    employee
                                  )
                                }
                                className="p-1.5 ml-5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                                title={`Delete ${employee.employeeName}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={
          confirmDeleteMapping
        }
        title="Delete mapping?"
        message={`Are you sure you want to delete the mapping "${deleteTarget}"?`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={
          handleConfirmDeleteMapping
        }
        onCancel={() => {
          setDeleteTarget('');
          setConfirmDeleteMapping(false);
        }}
      />

      <ConfirmModal
        isOpen={
          confirmDeleteEmployee
        }
        title="Delete employee?"
        message={`Are you sure you want to delete "${deleteEmployeeTarget}"? This will also delete all WhatsApp mappings associated with this employee.`}
        confirmText="Delete Employee"
        cancelText="Cancel"
        onConfirm={
          handleConfirmDeleteEmployee
        }
        onCancel={() => {
          setDeleteEmployeeTarget('');
          setConfirmDeleteEmployee(false);
        }}
      />

      {(successMessage ||
        errorMessage) && (
        <div className="fixed bottom-6 right-6 z-50 w-[min(420px,calc(100vw-2rem))]">
          <div
            className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-md ${
              successMessage
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            <div className="flex-1 text-sm leading-5">
              {successMessage ||
                errorMessage}
            </div>

            <button
              type="button"
              onClick={() => {
                setSuccessMessage('');
                setErrorMessage('');
              }}
              className={`flex-shrink-0 transition ${
                successMessage
                  ? 'text-emerald-400/70 hover:text-emerald-300'
                  : 'text-red-400/70 hover:text-red-300'
              }`}
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
