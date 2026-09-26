
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Database,
  Trash2,
  AlertTriangle,
  Settings,
  Loader2,
  ArrowUp,
} from 'lucide-react';
import AIResultModule from './AIProcess/AIResultModule';
import { AIAnalysisResult } from '@/src/utils/ai/aiTypes';
import ConfirmModal from './ConfirmModal';
import InputSection, { DataType } from './InputSection';
import ModuleSelector, {
  AnalysisModule,
  UploadedFile,
} from './ModuleSelector';
import DataTable from './DataTable';
import DataStats from './DataStats';
import AttendanceModule from './AttendanceModule';
import ReportsModule from './ReportsModule';
import SettingsModal from './SettingsModal';
import PenaltyModule from './PenaltyModule';
import EmployeeMapping from './EmployeeMapping';
import {
  loadEmployeeNameMappings,
} from '../utils/employeeApi';

import type {
  NameMapping,
} from '../utils/employeeApi';
import {
  parseWhatsAppChat,
  getWhatsAppMessageKey,
  dedupeWhatsAppMessages,
  type ParsedMessage,
} from '../utils/whatsappParser';
import type { AttendanceRecord } from '@/src/utils/attendanceUtils';
import type { PenaltyRecord } from '@/src/utils/penaltyParser';

interface AnalyzeResponse {
  success: boolean;
  type: DataType;
  data: Record<string, any>[];
  attendanceData: AttendanceRecord[];
  penaltyData: PenaltyRecord[];
  meta?: {
    rows: number;
    attendanceRows: number;
    penaltyRows: number;
  };
}

interface StoredAnalysis {
  id: string;
  name: string;
  size: number;
  type: string;
  sourceText: string;
  sourceType: string;
  status: 'ready' | 'processing' | 'completed' | 'error';
  error?: string;
  data: Record<string, any>[];
  attendanceData: AttendanceRecord[];
  penaltyData: PenaltyRecord[];
  uploadedAt: string;
  whatsappMessages?: ParsedMessage[];
  kind?: 'file' | 'batch';
  sourceFileIds?: string[];
}

const DB_NAME = 'coco-analyzer';
const DB_VERSION = 1;
const STORE_NAME = 'analyses';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) {
    return databasePromise;
  }

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
        });
      }
    };

    request.onsuccess = () => resolve(request.result);

    request.onerror = () => {
      databasePromise = null;
      reject(
        request.error ||
          new Error('Failed to open local database.')
      );
    };
  });

  return databasePromise;
}

async function getStoredAnalyses(): Promise<StoredAnalysis[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).getAll();

    request.onsuccess = () => {
      resolve(
        Array.isArray(request.result)
          ? request.result
          : []
      );
    };

    request.onerror = () => {
      reject(
        request.error ||
          new Error('Failed to load saved analyses.')
      );
    };
  });
}

async function saveStoredAnalysis(
  analysis: StoredAnalysis
): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      'readwrite'
    );

    transaction.objectStore(STORE_NAME).put(analysis);

    transaction.oncomplete = () => resolve();

    transaction.onerror = () =>
      reject(
        transaction.error ||
          new Error('Failed to save analysis.')
      );
  });
}

async function deleteStoredAnalysis(
  id: string
): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      'readwrite'
    );

    transaction.objectStore(STORE_NAME).delete(id);

    transaction.oncomplete = () => resolve();

    transaction.onerror = () =>
      reject(
        transaction.error ||
          new Error('Failed to delete analysis.')
      );
  });
}

async function clearStoredAnalyses(): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      STORE_NAME,
      'readwrite'
    );

    transaction.objectStore(STORE_NAME).clear();

    transaction.oncomplete = () => resolve();

    transaction.onerror = () =>
      reject(
        transaction.error ||
          new Error('Failed to clear saved analyses.')
      );
  });
}

async function getExistingWhatsAppMessages(): Promise<ParsedMessage[]> {
  const analyses = await getStoredAnalyses();
  const messages: ParsedMessage[] = [];

  for (const analysis of analyses) {
  if (analysis.kind === 'batch') continue;
  if (analysis.sourceType !== 'whatsapp') continue;

    if (analysis.whatsappMessages?.length) {
      messages.push(...analysis.whatsappMessages);
      continue;
    }

    if (analysis.sourceText) {
      messages.push(
        ...parseWhatsAppChat(
          analysis.sourceText
        )
      );
    }
  }

 return dedupeWhatsAppMessages(messages);
}

export default function App() {
  const [aiResult, setAiResult] =
  useState<AIAnalysisResult | null>(null);

const [isAIProcessing, setIsAIProcessing] =
  useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] =
    useState(false);
const [showScrollTop, setShowScrollTop] = useState(false);

const analyzeWithAI = async (text: string) => {
  console.log('ANALYZE WITH AI STARTED:', text.length);

  setIsAIProcessing(true);
  setError(null);

  try {
    const response = await fetch('/api/ai-process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    console.log('AI API STATUS:', response.status);

    const result = await response.json();

    console.log('AI API RESPONSE:', result);

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'AI processing failed.');
    }

    setAiResult(result.aiResult);
  } catch (error) {
    console.error('AI ANALYSIS ERROR:', error);
    throw error;
  } finally {
    setIsAIProcessing(false);
  }
};

useEffect(() => {
  const handleScroll = () => {
    setShowScrollTop(window.scrollY > 400);
  };

  window.addEventListener('scroll', handleScroll);

  return () => {
    window.removeEventListener('scroll', handleScroll);
  };
}, []);
  const [data, setData] = useState<
    Record<string, any>[]
  >([]);

  const [sourceText, setSourceText] =
    useState('');

  const [sourceType, setSourceType] =
    useState<DataType | null>(null);

  const [attendanceData, setAttendanceData] =
    useState<AttendanceRecord[]>([]);

  const [penaltyData, setPenaltyData] =
    useState<PenaltyRecord[]>([]);

 const [activeModule, setActiveModule] =
  useState<AnalysisModule>(() => {
    if (typeof window === 'undefined') {
      return 'input';
    }

    const saved =
      localStorage.getItem(
        'coco-active-module'
      );

    return (
      (saved as AnalysisModule) ||
      'input'
    );
  });

useEffect(() => {
  localStorage.setItem(
    'coco-active-module',
    activeModule
  );
}, [activeModule]);


  const [error, setError] =
    useState<string | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] =
    useState(false);

  const [isClearModalOpen, setIsClearModalOpen] =
    useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] =
    useState(false);

  const [fileToDelete, setFileToDelete] =
    useState<UploadedFile | null>(null);

  const [isLoading, setIsLoading] =
    useState(false);

  const [isRestoring, setIsRestoring] =
    useState(true);

  const [uploadedFiles, setUploadedFiles] =
    useState<UploadedFile[]>([]);
const [mappings, setMappings] =
  useState<NameMapping[]>([]);
  const [selectedFileIds, setSelectedFileIds] =
  useState<string[]>([]);
const [activeBatchId, setActiveBatchId] =
  useState<string | null>(null);
  const analyzedWhatsAppNames = useMemo(() => {
    if (sourceType !== 'whatsapp') {
      return [];
    }

    const names = new Map<string, string>();

    data.forEach(row => {
      const sender = String(row?.sender || '').trim();

      if (!sender) {
        return;
      }

      const key = sender.toLowerCase();

      if (!names.has(key)) {
        names.set(key, sender);
      }
    });

    return Array.from(names.values()).sort((a, b) =>
      a.localeCompare(b, undefined, {
        sensitivity: 'base',
      })
    );
  }, [data, sourceType]);
  const selectedFileName = useMemo(() => {
  if (selectedFileIds.length === 0) {
    return 'Analysis Results';
  }

  if (selectedFileIds.length === 1) {
    return (
      uploadedFiles.find(
        file => file.id === selectedFileIds[0]
      )?.name || 'Analysis Results'
    );
  }

  return `${selectedFileIds.length} files selected`;
}, [uploadedFiles, selectedFileIds]);

useEffect(() => {
  const loadMappings = async () => {
    try {
      const data =
        await loadEmployeeNameMappings();

      setMappings(data);
    } catch (error) {
      console.error(
        'Failed to load employee mappings:',
        error
      );

      setMappings([]);
    }
  };

  loadMappings();

  const handleMappingUpdate = () => {
    loadMappings();
  };

  window.addEventListener(
    'employee-mapping-updated',
    handleMappingUpdate
  );

  return () => {
    window.removeEventListener(
      'employee-mapping-updated',
      handleMappingUpdate
    );
  };
}, []);
  useEffect(() => {
    let mounted = true;

    const restoreWorkspace = async () => {
      try {
        if (
          typeof window === 'undefined' ||
          !('indexedDB' in window)
        ) {
          return;
        }

        const saved = await getStoredAnalyses();

        if (!mounted) return;

        // Analysis runs in this page, so processing records from a previous
        // session are interrupted jobs, not work that is still running.
        for (const record of saved) {
          if (record.kind !== 'batch' && record.status === 'processing') {
            record.status = 'ready';
            record.error = undefined;
            await saveStoredAnalysis(record);
          }
        }

        if (!mounted) return;

        const sorted = [...saved].sort(
          (a, b) =>
            new Date(b.uploadedAt).getTime() -
            new Date(a.uploadedAt).getTime()
        );

        const fileAnalyses =
  sorted.filter(
    item => item.kind !== 'batch'
  );

const batchAnalyses =
  sorted.filter(
    item =>
      item.kind === 'batch'
  );

  const savedModule =
  localStorage.getItem(
    'coco-active-module'
  ) as AnalysisModule | null;

setUploadedFiles(
  fileAnalyses.map(item => ({
    id: item.id,
    name: item.name,
    size: item.size,
    type: item.type,
    status: item.status,
    uploadedAt: item.uploadedAt,
    error: item.error,
  }))
);

        if (batchAnalyses.length > 0) {
  const latestBatch =
    batchAnalyses[0];
setActiveBatchId(latestBatch.id);
  const validSelectedIds =
    (latestBatch.sourceFileIds ||
      []).filter(id =>
      fileAnalyses.some(
        file => file.id === id
      )
    );

  setSelectedFileIds(
    validSelectedIds
  );

  setSourceText(
    latestBatch.sourceText || ''
  );

  setSourceType(
    latestBatch.sourceType as DataType
  );

  setData(
    latestBatch.data || []
  );

  setAttendanceData(
    latestBatch.attendanceData || []
  );

  setPenaltyData(
    latestBatch.penaltyData || []
  );

} else if (fileAnalyses.length > 0) {
  const first = fileAnalyses[0];

  setActiveBatchId(null);

  setSelectedFileIds([
    first.id,
  ]);

  setSourceText(
    first.sourceText || ''
  );

  setSourceType(
    first.sourceType as DataType
  );

  setData(
    first.data || []
  );

  setAttendanceData(
    first.attendanceData || []
  );

  setPenaltyData(
    first.penaltyData || []
  );
} else {
  setActiveBatchId(null);
  setSelectedFileIds([]);
  setActiveModule('input');
}
if (
  batchAnalyses.length > 0 ||
  fileAnalyses.length > 0
) {
  if (savedModule) {
    setActiveModule(savedModule);
  } else {
    const source =
      batchAnalyses.length > 0
        ? batchAnalyses[0].sourceType
        : fileAnalyses[0].sourceType;

    const defaultModule =
      source === 'whatsapp'
        ? 'attendance'
        : 'raw_data';

    setActiveModule(defaultModule);

    localStorage.setItem(
      'coco-active-module',
      defaultModule
    );
  }
}
      } catch (error) {
        console.error(
          'Failed to restore workspace:',
          error
        );

        if (mounted) {
          setError(
            'Saved workspace could not be restored.'
          );
        }
      } finally {
        if (mounted) {
          setIsRestoring(false);
        }
      }
    };

    restoreWorkspace();

    return () => {
      mounted = false;
    };
  }, []);

  const analyzeData = async (
    text: string,
    type: DataType
  ): Promise<AnalyzeResponse> => {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({
        text,
        type,
      }),
    });

    let result: any = null;

    try {
      result = await response.json();
    } catch {
      throw new Error(
        'Invalid response received from the analyzer server.'
      );
    }

    if (!response.ok) {
      throw new Error(
        result?.error ||
          'Failed to analyze data.'
      );
    }

    if (
      !Array.isArray(result?.data) ||
      result.data.length === 0
    ) {
      throw new Error(
        'No valid data could be parsed. Check your input format.'
      );
    }

    return result as AnalyzeResponse;
  };

  const applyAnalysisResult = (
    result: AnalyzeResponse
  ) => {
    setData(
      Array.isArray(result.data)
        ? result.data
        : []
    );

    setAttendanceData(
      Array.isArray(result.attendanceData)
        ? result.attendanceData
        : []
    );

    setPenaltyData(
      Array.isArray(result.penaltyData)
        ? result.penaltyData
        : []
    );
  };

  const handleToggleFileSelection = (id: string) => {
  const file = uploadedFiles.find(
    item => item.id === id
  );

  if (
  !file ||
  file.status === 'processing' ||
  file.status === 'error'
) {
  return;
}

  setSelectedFileIds(previous =>
    previous.includes(id)
      ? previous.filter(fileId => fileId !== id)
      : [...previous, id]
  );
};

const handleSelectAllFiles = () => {
  setSelectedFileIds(
    uploadedFiles
      .filter(
        file =>
          file.status !== 'processing' &&
          file.status !== 'error'
      )
      .map(file => file.id)
  );
};

const handleClearFileSelection = () => {
  setSelectedFileIds([]);
};

  useEffect(() => {
  const handleMappingUpdate = async () => {
    if (
      selectedFileIds.length === 0 ||
      !sourceText.trim() ||
      !sourceType
    ) {
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const result = await analyzeData(
        sourceText,
        sourceType
      );

      applyAnalysisResult(result);

      const targetId =
        activeBatchId ||
        selectedFileIds[0];

      const saved =
        await getStoredAnalyses();

      const current =
        saved.find(
          item => item.id === targetId
        );

      if (current) {
        await saveStoredAnalysis({
          ...current,
          sourceText,
          sourceType: result.type,
          data: result.data,
          attendanceData:
            result.attendanceData,
          penaltyData:
            result.penaltyData,
          status: 'completed',
          error: undefined,
        });
      }
    } catch (error) {
      setError(
        getErrorMessage(
          error,
          'Failed to re-analyze data after employee mapping update.'
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  window.addEventListener(
    'employee-mapping-updated',
    handleMappingUpdate
  );

  return () => {
    window.removeEventListener(
      'employee-mapping-updated',
      handleMappingUpdate
    );
  };
}, [
  activeBatchId,
  selectedFileIds,
  sourceText,
  sourceType,
]);

  const createFileId = (
    name: string,
    size: number
  ) =>
    [
      name,
      size,
      Date.now(),
      Math.random()
        .toString(36)
        .slice(2),
    ].join('-');

    interface PreparedFile {
  id: string;
  file: File;
  record: StoredAnalysis;
  analysisText: string;
  sourceType: DataType;
}

const prepareFile = async (
  file: File,
  existingWhatsAppKeys: Set<string>
): Promise<PreparedFile | null> => {
  const extension =
    file.name
      .split('.')
      .pop()
      ?.toLowerCase();

  let type: DataType = 'auto';

  if (extension === 'csv') {
    type = 'csv';
  } else if (extension === 'json') {
    type = 'json';
  } else if (extension === 'txt') {
    type = 'whatsapp';
  }

  const text = await file.text();

  let analysisText = text;
  let whatsappMessages:
    | ParsedMessage[]
    | undefined;

  if (type === 'whatsapp') {
    const incomingMessages =
      parseWhatsAppChat(text);

    const newMessages =
      incomingMessages.filter(message => {
        const key =
          getWhatsAppMessageKey(message);

        if (existingWhatsAppKeys.has(key)) {
          return false;
        }

        existingWhatsAppKeys.add(key);
        return true;
      });

    if (!newMessages.length) {
      return null;
    }

    whatsappMessages = newMessages;

    analysisText = newMessages
      .map(
        message =>
          `[${message.date}, ${message.time}] ${message.sender}: ${message.message}`
      )
      .join('\n');
  }

  const fileId = createFileId(
    file.name,
    file.size
  );

  const now =
    new Date().toISOString();

  const fileType =
    file.type ||
    `.${extension || 'file'}`;

  const pending: StoredAnalysis = {
    id: fileId,
    name: file.name,
    size: file.size,
    type: fileType,
    sourceType: type,
    sourceText: analysisText,
    // The source is saved and ready to retry even if automatic analysis fails.
    status: 'ready',
    uploadedAt: now,
    data: [],
    attendanceData: [],
    penaltyData: [],
    whatsappMessages,
    kind: 'file',
  };

  await saveStoredAnalysis(pending);

  setUploadedFiles(previous => [
    {
      id: fileId,
      name: file.name,
      size: file.size,
      type: fileType,
      status: 'ready',
      uploadedAt: now,
    },
    ...previous,
  ]);

  return {
    id: fileId,
    file,
    record: pending,
    analysisText,
    sourceType: type,
  };
};

const deleteBatchAnalyses = async () => {
  const saved = await getStoredAnalyses();

  const batchAnalyses = saved.filter(
    item => item.kind === 'batch'
  );

  for (const analysis of batchAnalyses) {
    await deleteStoredAnalysis(
      analysis.id
    );
  }
};

const analyzePreparedFiles = async (
  preparedFiles: PreparedFile[]
) => {
  if (!preparedFiles.length) {
    throw new Error(
      'No new data was found in the selected files.'
    );
  }

  const types = [
    ...new Set(
      preparedFiles.map(
        item => item.sourceType
      )
    ),
  ];

  if (types.length !== 1) {
    throw new Error(
      'Please select files of the same data type before analyzing them together.'
    );
  }

  const analysisType =
    types[0];

  const combinedText =
    preparedFiles
      .map(item => item.analysisText)
      .join('\n\n');

  if (!combinedText.trim()) {
    throw new Error(
      'Selected files contain no analyzable data.'
    );
  }

  const result =
    await analyzeData(
      combinedText,
      analysisType
    );

  await deleteBatchAnalyses();

  const batchId = createFileId(
    'Combined Analysis',
    combinedText.length
  );

  const batch: StoredAnalysis = {
    id: batchId,
    name:
      preparedFiles.length === 1
        ? preparedFiles[0].file.name
        : `${preparedFiles.length} Files Combined`,
    size: new Blob([
      combinedText,
    ]).size,
    type:
      preparedFiles.length === 1
        ? preparedFiles[0].record.type
        : 'application/x-coco-batch',
    sourceText: combinedText,
    sourceType: result.type,
    status: 'completed',
    uploadedAt:
      new Date().toISOString(),
    data: result.data,
    attendanceData:
      result.attendanceData,
    penaltyData:
      result.penaltyData,
    whatsappMessages:
      preparedFiles
        .flatMap(
          item =>
            item.record.whatsappMessages || []
        ),
    kind: 'batch',
    sourceFileIds:
      preparedFiles.map(
        item => item.id
      ),
  };

  await saveStoredAnalysis(batch);

  for (const prepared of preparedFiles) {
    await saveStoredAnalysis({
      ...prepared.record,
      status: 'completed',
      error: undefined,
    });
  }

  setUploadedFiles(previous =>
    previous.map(file =>
      preparedFiles.some(
        prepared =>
          prepared.id === file.id
      )
        ? {
            ...file,
            status: 'completed',
            error: undefined,
          }
        : file
    )
  );

  const ids =
    preparedFiles.map(
      item => item.id
    );

  setActiveBatchId(batchId);
setSelectedFileIds(ids);
setSourceText(combinedText);
setSourceType(result.type);

  applyAnalysisResult(result);

  const nextModule =
    result.type === 'whatsapp'
      ? 'attendance'
      : 'raw_data';

  setActiveModule(nextModule);

  localStorage.setItem(
    'coco-active-module',
    nextModule
  );
};

const handleAnalyzeSelectedFiles = async () => {
  if (isLoading || selectedFileIds.length === 0) {
    return;
  }

  setError(null);
  setIsLoading(true);

  try {
    const saved =
      await getStoredAnalyses();

    const selectedRecords =
      selectedFileIds
        .map(id =>
          saved.find(
            item =>
              item.id === id &&
              item.kind !== 'batch'
          )
        )
        .filter(
          (
            item
          ): item is StoredAnalysis =>
            Boolean(item)
        );

    if (!selectedRecords.length) {
      throw new Error(
        'No selected files were found.'
      );
    }

    if (
      selectedRecords.some(
        item =>
          item.status === 'processing'
      )
    ) {
      throw new Error(
        'Please wait until file processing is complete.'
      );
    }

    if (
      selectedRecords.some(
        item =>
          item.status === 'error'
      )
    ) {
      throw new Error(
        'One or more selected files contain errors.'
      );
    }

    const types = [
      ...new Set(
        selectedRecords.map(
          item =>
            item.sourceType
        )
      ),
    ];

    if (types.length !== 1) {
      throw new Error(
        'Please select files of the same data type before analyzing them together.'
      );
    }

    const analysisType =
      types[0] as DataType;

    let combinedText = '';
    let combinedMessages:
      | ParsedMessage[]
      | undefined;

    if (analysisType === 'whatsapp') {
      const seenKeys =
        new Set<string>();

      const messages: ParsedMessage[] =
        [];

      for (const record of selectedRecords) {
        const recordMessages =
          record.whatsappMessages?.length
            ? record.whatsappMessages
            : parseWhatsAppChat(
                record.sourceText
              );

        for (const message of recordMessages) {
          const key =
            getWhatsAppMessageKey(
              message
            );

          if (seenKeys.has(key)) {
            continue;
          }

          seenKeys.add(key);
          messages.push(message);
        }
      }

      if (!messages.length) {
        throw new Error(
          'The selected WhatsApp files contain no new messages.'
        );
      }

      combinedMessages = messages;

      combinedText =
        messages
          .map(
            message =>
              `[${message.date}, ${message.time}] ${message.sender}: ${message.message}`
          )
          .join('\n');
    } else {
      combinedText =
        selectedRecords
          .map(
            record =>
              record.sourceText.trim()
          )
          .filter(Boolean)
          .join('\n\n');
    }

    if (!combinedText.trim()) {
      throw new Error(
        'Selected files contain no analyzable data.'
      );
    }

    const result =
      await analyzeData(
        combinedText,
        analysisType
      );

    await deleteBatchAnalyses();

    const batchId =
      createFileId(
        'Combined Analysis',
        combinedText.length
      );

    const batch: StoredAnalysis = {
      id: batchId,
      name:
        selectedRecords.length === 1
          ? selectedRecords[0].name
          : `${selectedRecords.length} Files Combined`,
      size: new Blob([
        combinedText,
      ]).size,
      type:
        selectedRecords.length === 1
          ? selectedRecords[0].type
          : 'application/x-coco-batch',
      sourceText: combinedText,
      sourceType: result.type,
      status: 'completed',
      uploadedAt:
        new Date().toISOString(),
      data: result.data,
      attendanceData:
        result.attendanceData,
      penaltyData:
        result.penaltyData,
      whatsappMessages:
        combinedMessages,
      kind: 'batch',
      sourceFileIds:
        selectedRecords.map(
          record => record.id
        ),
    };

    await saveStoredAnalysis(batch);

    for (const record of selectedRecords) {
      await saveStoredAnalysis({
        ...record,
        status: 'completed',
        error: undefined,
      });
    }

    const completedIds = new Set(selectedRecords.map(record => record.id));
    setUploadedFiles(previous => previous.map(file =>
      completedIds.has(file.id)
        ? { ...file, status: 'completed', error: undefined }
        : file
    ));

    setActiveBatchId(batchId);
    setSourceText(combinedText);
    setSourceType(result.type);

    applyAnalysisResult(result);

    const nextModule =
      result.type === 'whatsapp'
        ? 'attendance'
        : 'raw_data';

    setActiveModule(nextModule);

    localStorage.setItem(
      'coco-active-module',
      nextModule
    );
  } catch (error) {
    setError(
      getErrorMessage(
        error,
        'Failed to analyze selected files.'
      )
    );
  } finally {
    setIsLoading(false);
  }
};

const handleUpload = async (
  files: File[]
) => {
  if (isLoading || !files.length) return;

  setError(null);
  setIsLoading(true);

  try {
    const existing =
      await getStoredAnalyses();

    const existingNonWhatsAppKeys =
      new Set(
        existing
          .filter(
            item =>
              item.kind !== 'batch' &&
              item.sourceType !== 'whatsapp'
          )
          .map(
            item =>
              `${item.name}:${item.size}`
          )
      );

    const existingWhatsAppMessages =
      await getExistingWhatsAppMessages();

    const existingWhatsAppKeys =
      new Set(
        existingWhatsAppMessages.map(
          getWhatsAppMessageKey
        )
      );

    const batchKeys =
      new Set<string>();

    const uniqueFiles =
      files.filter(file => {
        const extension =
          file.name
            .split('.')
            .pop()
            ?.toLowerCase();

        const key =
          `${file.name}:${file.size}`;

        if (extension === 'txt') {
          if (batchKeys.has(key)) {
            return false;
          }

          batchKeys.add(key);
          return true;
        }

        if (
          existingNonWhatsAppKeys.has(
            key
          ) ||
          batchKeys.has(key)
        ) {
          return false;
        }

        batchKeys.add(key);

        return true;
      });

    if (!uniqueFiles.length) {
      throw new Error(
        'These files are already uploaded.'
      );
    }

    const preparedFiles: PreparedFile[] = [];

    for (const file of uniqueFiles) {
      const prepared =
        await prepareFile(
          file,
          existingWhatsAppKeys
        );

      if (prepared) {
        preparedFiles.push(prepared);
      }
    }

    if (!preparedFiles.length) {
      throw new Error(
        'The selected WhatsApp files contain no new messages.'
      );
    }

    await analyzePreparedFiles(
      preparedFiles
    );
  } catch (error) {
    const message =
      getErrorMessage(
        error,
        'Failed to upload files.'
      );

    setError(message);
  } finally {
    setIsLoading(false);
  }
};


 const handleDataReady = async (
  text: string,
  type: DataType
) => {
  console.log('HANDLE DATA READY:', type);

  if (type === 'ai') {
    console.log('AI BRANCH STARTED');

    setIsLoading(true);

    try {
      await analyzeWithAI(text);
      console.log('AI ANALYSIS COMPLETED');
      setActiveModule('ai_result');
    } catch (error) {
      console.error('AI BRANCH ERROR:', error);
      setError(
        error instanceof Error
          ? error.message
          : 'AI processing failed.'
      );
    } finally {
      setIsLoading(false);
    }

    return;
  }
    if (!text.trim()) return;

    setError(null);
    setIsLoading(true);

    const fileId = createFileId(
      'Pasted Data',
      text.length
    );

    const now =
      new Date().toISOString();

    try {
      let analysisText = text;
      let whatsappMessages:
        | ParsedMessage[]
        | undefined;

      if (type === 'whatsapp') {
        const incomingMessages =
          parseWhatsAppChat(text);

        const existingMessages =
          await getExistingWhatsAppMessages();

        const existingKeys = new Set(
          existingMessages.map(
            getWhatsAppMessageKey
          )
        );

        const newMessages =
          incomingMessages.filter(
            message =>
              !existingKeys.has(
                getWhatsAppMessageKey(
                  message
                )
              )
          );

        if (!newMessages.length) {
          setError(
            'This WhatsApp data contains no new messages. Existing messages were not stored again.'
          );
          return;
        }

        whatsappMessages =
          newMessages;

        analysisText =
          newMessages
            .map(
              message =>
                `[${message.date}, ${message.time}] ${message.sender}: ${message.message}`
            )
            .join('\n');
      }

      const result =
        await analyzeData(
          analysisText,
          type
        );

      const size =
        new Blob([analysisText]).size;

      const name =
        result.type === 'whatsapp'
          ? 'WhatsApp Data'
          : result.type === 'csv'
          ? 'Pasted CSV'
          : result.type === 'json'
          ? 'Pasted JSON'
          : 'Pasted Data';

      const saved: StoredAnalysis = {
        id: fileId,
        name,
        size,
        type: 'text/plain',
        sourceType: result.type,
        sourceText: analysisText,
        status: 'completed',
        uploadedAt: now,
        data: result.data,
        attendanceData:
          result.attendanceData,
        penaltyData:
          result.penaltyData,
        whatsappMessages,
      };

      await saveStoredAnalysis(
        saved
      );

      setUploadedFiles(previous => [
        {
          id: fileId,
          name,
          size,
          type: 'text/plain',
          status: 'completed',
          uploadedAt: now,
        },
        ...previous,
      ]);
      setActiveBatchId(null);
      setSelectedFileIds([fileId]);
      setSourceText(analysisText);
      setSourceType(result.type);

      applyAnalysisResult(result);

     const nextModule =
  result.type === 'whatsapp'
    ? 'attendance'
    : 'raw_data';

setActiveModule(nextModule);

localStorage.setItem(
  'coco-active-module',
  nextModule
);
    } catch (error) {
      setError(
        getErrorMessage(
          error,
          'An error occurred while analyzing the data.'
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFile = (
    id: string
  ) => {
    const file =
      uploadedFiles.find(
        item => item.id === id
      );

    if (!file) return;

    setFileToDelete(file);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteFile = async () => {
  if (!fileToDelete) return;

  const id = fileToDelete.id;

  try {
    const saved =
      await getStoredAnalyses();

    const activeBatch =
      activeBatchId
        ? saved.find(
            item =>
              item.id === activeBatchId
          )
        : null;

    await deleteStoredAnalysis(id);

    const remaining =
      uploadedFiles.filter(
        file => file.id !== id
      );

    setUploadedFiles(
      remaining
    );

    setSelectedFileIds(
      previous =>
        previous.filter(
          fileId => fileId !== id
        )
    );

    if (
      activeBatch?.sourceFileIds?.includes(
        id
      )
    ) {
      await deleteStoredAnalysis(
        activeBatch.id
      );

      setActiveBatchId(null);
      setSourceText('');
      setSourceType(null);
      setData([]);
      setAttendanceData([]);
      setPenaltyData([]);
      setActiveModule('input');
    }

    setIsDeleteModalOpen(false);
    setFileToDelete(null);
  } catch (error) {
    setError(
      getErrorMessage(
        error,
        'Failed to remove file.'
      )
    );
  }
};

  const handleReset = () => {
    setIsClearModalOpen(true);
  };

  const confirmReset =
    async () => {
      try {
        await clearStoredAnalyses();
        localStorage.removeItem(
        'coco-active-module'
      );
        setUploadedFiles([]);
        setSelectedFileIds([]);
        setActiveBatchId(null);
        setData([]);
        setSourceText('');
        setSourceType(null);
        setAttendanceData([]);
        setPenaltyData([]);
        setActiveModule('input');
        setError(null);
        setIsClearModalOpen(false);
      } catch (error) {
        setError(
          getErrorMessage(
            error,
            'Failed to clear saved data.'
          )
        );
      }
    };

 const handleModuleSelect =
  (module: AnalysisModule) => {
    if (
      module === 'ai_settings'
    ) {
      setIsSettingsOpen(true);
      return;
    }

    setActiveModule(module);

    localStorage.setItem(
      'coco-active-module',
      module
    );

    setError(null);
  };

  const modals = (
    <>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() =>
          setIsSettingsOpen(false)
        }
        onSave={() =>
          setError(null)
        }
      />

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Delete file?"
        message={
          fileToDelete
            ? `Are you sure you want to delete "${fileToDelete.name}"? Its saved analysis will also be removed. This action cannot be undone.`
            : 'Are you sure you want to delete this file?'
        }
        confirmText="Delete File"
        cancelText="Cancel"
        onConfirm={
          confirmDeleteFile
        }
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setFileToDelete(null);
        }}
      />

      <ConfirmModal
        isOpen={isClearModalOpen}
        title="Clear all data?"
        message="This will remove all uploaded files and generated analysis results from this browser. This action cannot be undone."
        confirmText="Clear Data"
        cancelText="Cancel"
        onConfirm={
          confirmReset
        }
        onCancel={() =>
          setIsClearModalOpen(false)
        }
      />
    </>
  );
  const analysisOverlay = isLoading && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-700 bg-surface px-8 py-7 shadow-2xl">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>

        <div className="text-center">
          <p className="text-base font-semibold text-white">
            Analyzing Data...
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Please wait while your data is being processed.
          </p>
        </div>
      </div>
    </div>
  );
  const errorBanner =
    error && (
      <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl flex items-center">
        <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0" />
        <span className="text-sm">
          {error}
        </span>
      </div>
    );

  if (isRestoring) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center text-slate-400">
          <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
          <p className="text-sm text-slate-500">
            Restoring workspace...
          </p>
        </div>
      </div>
    );
  }

  if (
    uploadedFiles.length === 0 &&
    data.length === 0 &&
    activeModule !== 'ai_result'
  ) {
    return (
      <div className="min-h-screen">
        {modals}
        
        <div className="p-6 md:p-12">
          <header className="max-w-4xl mx-auto mb-10 text-center relative">
            {/* <button
              type="button"
              onClick={() =>
                setIsSettingsOpen(true)
              }
              className="absolute right-0 top-0 p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full transition-colors"
              title="AI Settings"
            >
              <Settings className="w-5 h-5" />
            </button> */}

            <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-full mb-4">
              <Database className="w-12 h-12 text-primary" />
            </div>

            <h1 className="text-5xl md:text-6xl font-title tracking-wide mb-4">
              COCO{' '}
              <span className="text-primary">
                Analyzer
              </span>
            </h1>

            <p className="text-lg text-slate-400 max-w-2xl mx-auto mt-4">
              {/* Upload or paste your CSV,
              JSON, or WhatsApp text logs
              and get instant, dynamic
              analysis perfectly tailored
              to your data&apos;s schema. */}
              Upload or paste your
               WhatsApp text logs
              and get instant, dynamic
              analysis perfectly tailored
              to your data&apos;s schema.
            </p>
          </header>

          <main className="max-w-7xl mx-auto">
            {errorBanner}

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                <p className="text-lg font-medium text-slate-300">
                  Analyzing your data...
                </p>
              </div>
            ) : (
              <InputSection
  onDataReady={
    handleDataReady
  }
  onUpload={
    handleUpload
  }
  uploadedFiles={
    uploadedFiles
  }
  selectedFileIds={
    selectedFileIds
  }
  onToggleFile={
    handleToggleFileSelection
  }
  onSelectAllFiles={
    handleSelectAllFiles
  }
  onClearSelection={
    handleClearFileSelection
  }
  onAnalyzeSelected={
    handleAnalyzeSelectedFiles
  }
  onRemoveFile={
    handleRemoveFile
  }
  onClearFiles={
    handleReset
  }
/>
            )}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {modals}
      {analysisOverlay}
      <aside
        className={`fixed left-0 top-0 h-screen z-40 transition-all duration-300 ${
          isSidebarCollapsed
            ? 'w-16'
            : 'w-64'
        }`}
      >
        <ModuleSelector
          activeModule={
            activeModule
          }
          onSelect={
            handleModuleSelect
          }
          isCollapsed={
            isSidebarCollapsed
          }
          onToggleCollapse={() =>
            setIsSidebarCollapsed(
              previous =>
                !previous
            )
          }
        />
      </aside>

      <main
        className={`min-h-screen transition-all duration-300 ${
          isSidebarCollapsed
            ? 'ml-16'
            : 'ml-64'
        }`}
      >
        <div className="px-6 py-6 md:px-10 md:py-8">
          <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-xl">
                <Database className="w-7 h-7 text-primary" />
              </div>

              <div>
                <h1 className="text-2xl md:text-3xl font-bold">
                  COCO{' '}
                  <span className="text-primary">
                    Analyzer
                  </span>
                </h1>

                <div className="flex items-center gap-2 text-sm text-slate-400 mt-1">
                  <span className="max-w-[300px] truncate">
                    {selectedFileName}
                  </span>

                  <span className="text-slate-600">
                    •
                  </span>

                  <span>
                    {data.length.toLocaleString()}{' '}
                    rows
                  </span>
                </div>
              </div>
            </div>

            {activeModule === 'input' && uploadedFiles.length > 0 && (
              <button
                type="button"
                onClick={
                  handleReset
                }
                className="w-fit flex items-center text-red-400 hover:text-red-300 bg-red-400/10 hover:bg-red-400/20 px-4 py-2.5 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </button>
            )}
          </header>

          {errorBanner}

          <section className="w-full">
            {activeModule === 'input' && (
              <div className="max-w-7xl mx-auto">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                    <p className="text-lg font-medium text-slate-300">
                      Analyzing your data...
                    </p>
                  </div>
                ) : (
                  <InputSection
  onDataReady={
    handleDataReady
  }
  onUpload={
    handleUpload
  }
  uploadedFiles={
    uploadedFiles
  }
  selectedFileIds={
    selectedFileIds
  }
  onToggleFile={
    handleToggleFileSelection
  }
  onSelectAllFiles={
    handleSelectAllFiles
  }
  onClearSelection={
    handleClearFileSelection
  }
  onAnalyzeSelected={
    handleAnalyzeSelectedFiles
  }
  onRemoveFile={
    handleRemoveFile
  }
  onClearFiles={
    handleReset
  }
/>
                )}
              </div>
            )}

            {activeModule === 'raw_data' && (
              <DataTable
                data={data}
              />
            )}

            {activeModule === 'stats' && (
              <DataStats
                data={data}
              />
            )}

            {activeModule === 'attendance' && (
              <AttendanceModule
                attendanceData={
                  attendanceData
                }
              />
            )}

            {activeModule === 'reports' && (
              <ReportsModule
  attendanceData={
    attendanceData
  }
  penaltyData={
    penaltyData
  }
  mappings={
    mappings
  }
/>
            )}

            {activeModule === 'penalty' && (
              <PenaltyModule
                penaltyData={
                  penaltyData
                }
              />
            )}
{/* {activeModule === 'ai_result' && (
  <AIResultModule
    result={aiResult}
    isLoading={isAIProcessing}
  />
)} */}
            {activeModule === 'employee_mapping' && (
              <EmployeeMapping
                analyzedNames={
                  analyzedWhatsAppNames
                }
              />
            )}
          </section>
          {showScrollTop && (
  <button
    type="button"
    onClick={() =>
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      })
    }
    className="fixed bottom-6 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-all hover:scale-105 hover:opacity-90"
    title="Go to top"
    aria-label="Go to top"
  >
    <ArrowUp className="h-5 w-5" />
  </button>
)}
        </div>
      </main>
    </div>
  );
}
