'use client';

import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileText,
  Send,
  Settings,
  X,
  File,
  CheckCircle2,
  Loader2,
  UploadCloud,
  ClipboardPaste,
  Sparkles,
} from 'lucide-react';
import type { UploadedFile } from './ModuleSelector';
export type DataType =
  | 'auto'
  | 'csv'
  | 'json'
  | 'whatsapp'
  | 'ai';

interface InputSectionProps {
  onDataReady: (text: string, type: DataType) => Promise<void> | void;
  onUpload?: (files: File[]) => Promise<void> | void;
  uploadedFiles?: UploadedFile[];
  selectedFileIds?: string[];
  onToggleFile?: (id: string) => void;
  onSelectAllFiles?: () => void;
  onClearSelection?: () => void;
  onAnalyzeSelected?: () => Promise<void> | void;
  onRemoveFile?: (id: string) => void;
  onClearFiles?: () => void;
}

interface SelectedFile {
  file: File;
  id: string;
}

export default function InputSection({
  onDataReady,
  onUpload,
  uploadedFiles = [],
  selectedFileIds = [],
  onToggleFile,
  onSelectAllFiles,
  onClearSelection,
  onAnalyzeSelected,
  onRemoveFile,
  onClearFiles,
}: InputSectionProps) {
  const [activeTab, setActiveTab] =
    useState<'upload' | 'paste'>('upload');

  const [text, setText] = useState('');

  const [dataType, setDataType] =
    useState<DataType>('auto');

  const [selectedFiles, setSelectedFiles] =
    useState<SelectedFile[]>([]);

  const [isUploading, setIsUploading] =
    useState(false);

  const [isDragOver, setIsDragOver] =
    useState(false);

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  /*
   * --------------------------------------------------
   * FILE TYPE DETECTION
   * --------------------------------------------------
   */

 const detectFileType = (
  file: File
): Exclude<DataType,'auto'> => {
  if (dataType !== 'auto') {
    return dataType;
  }

  const extension = file.name
    .split('.')
    .pop()
    ?.toLowerCase();

  if (extension === 'csv') {
    return 'csv';
  }

  if (extension === 'json') {
    return 'json';
  }

  if (extension === 'txt') {
    return 'whatsapp';
  }

  if (
    extension === 'xlsx' ||
    extension === 'xls'
  ) {
    return 'csv';
  }

  return 'csv';
};

  /*
   * --------------------------------------------------
   * ADD FILES
   * --------------------------------------------------
   */

  const addFiles = (
    files: FileList | File[]
  ) => {
    const incomingFiles =
  Array.from(files).filter(file =>
    /\.(txt|csv|json|xlsx|xls)$/i.test(
      file.name
    )
  );

    if (incomingFiles.length === 0) {
      return;
    }

    const newFiles = incomingFiles
      .filter(newFile =>
        !selectedFiles.some(
          existing =>
            existing.file.name ===
              newFile.name &&
            existing.file.size ===
              newFile.size
        )
      )
      .map(file => ({
        file,
        id: [
          file.name,
          file.size,
          file.lastModified,
          Math.random(),
        ].join('-'),
      }));

    setSelectedFiles(previous => [
      ...previous,
      ...newFiles,
    ]);
  };

  /*
   * --------------------------------------------------
   * FILE INPUT
   * --------------------------------------------------
   */

  const handleFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (event.target.files) {
      addFiles(event.target.files);
    }

    event.target.value = '';
  };

  /*
   * --------------------------------------------------
   * DRAG & DROP
   * --------------------------------------------------
   */

  const handleDragOver = (
    event: React.DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (
    event: React.DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (
    event: React.DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    setIsDragOver(false);

    if (event.dataTransfer.files) {
      addFiles(event.dataTransfer.files);
    }
  };

  /*
   * --------------------------------------------------
   * REMOVE FILE
   * --------------------------------------------------
   */

  const removeFile = (id: string) => {
    setSelectedFiles(previous =>
      previous.filter(
        file => file.id !== id
      )
    );
  };

  const clearFiles = () => {
    if (isUploading) {
      return;
    }

    setSelectedFiles([]);
  };

  /*
   * --------------------------------------------------
   * READ FILE
   * --------------------------------------------------
   */

  const readFile = (
    file: File
  ): Promise<string> => {
    return new Promise(
      (resolve, reject) => {
        const reader =
          new FileReader();

        reader.onload = event => {
          const result =
            event.target?.result;

          if (
            typeof result === 'string'
          ) {
            resolve(result);
          } else {
            reject(
              new Error(
                `Unable to read ${file.name}`
              )
            );
          }
        };

        reader.onerror = () => {
          reject(
            new Error(
              `Failed to read ${file.name}`
            )
          );
        };

        reader.readAsText(file);
      }
    );
  };
const readXlsxFile = async (
  file: File
): Promise<string> => {
  const buffer = await file.arrayBuffer();

  const workbook = XLSX.read(buffer, {
    type: 'array',
  });

  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error(
      `No worksheet found in ${file.name}`
    );
  }

  const worksheet =
    workbook.Sheets[sheetName];

  return XLSX.utils.sheet_to_csv(
    worksheet
  );
};
  /*
   * --------------------------------------------------
   * ANALYZE FILES
   * --------------------------------------------------
   */

  const handleAnalyzeFiles = async () => {
  if (!selectedFiles.length || isUploading) return;
  setIsUploading(true);

  try {
    const hasXlsx = selectedFiles.some(({ file }) =>
  /\.(xlsx|xls)$/i.test(file.name)
);

if (onUpload && dataType !== 'ai' && !hasXlsx) {
  await onUpload(
    selectedFiles.map(({ file }) => file)
  );
  setSelectedFiles([]);
  return;
}

const contents = await Promise.all(
  selectedFiles.map(({ file }) =>
    /\.(xlsx|xls)$/i.test(file.name)
      ? readXlsxFile(file)
      : readFile(file)
  )
);

const combinedText = contents.join('\n\n');

let detectedType: Exclude<DataType,'auto'>;

if (dataType === 'auto') {
  const types = selectedFiles.map(({ file }) =>
    detectFileType(file)
  );

  if (types.includes('whatsapp')) {
    detectedType = 'whatsapp';
  } else if (types.includes('json')) {
    detectedType = 'json';
  } else {
    detectedType = 'csv';
  }
} else {
  detectedType = dataType;
}

await onDataReady(
  combinedText,
  detectedType
);
  } catch (error) {
    console.error('File upload error:', error);
  } finally {
    setIsUploading(false);
  }
};

  /*
   * --------------------------------------------------
   * PASTE TYPE DETECTION
   * --------------------------------------------------
   */

 const detectPasteType = (): Exclude<DataType,'auto'> => {
  if (dataType !== 'auto') {
    return dataType;
  }

  const cleanText = text
    .trim()
    .replace(/[\u200E\u200F\u202A-\u202E\u2066\u2067]/g,'');

  const whatsappRegex = /^\[\d{1,4}[\/.-]\d{1,2}[\/.-]\d{1,4},\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\]/m;

  if (whatsappRegex.test(cleanText)) {
    return 'whatsapp';
  }

  if (
    cleanText.startsWith('[') ||
    cleanText.startsWith('{')
  ) {
    try {
      JSON.parse(cleanText);
      return 'json';
    } catch {
      // Not valid JSON, continue detection
    }
  }

  if (cleanText.includes(',')) {
    return 'csv';
  }

  return 'whatsapp';
};

  /*
   * --------------------------------------------------
   * PASTE SUBMIT
   * --------------------------------------------------
   */

  const handlePasteSubmit = () => {
    if (!text.trim()) {
      return;
    }

    const detectedType =
      detectPasteType();

    onDataReady(
      text,
      detectedType
    );
  };

  /*
   * --------------------------------------------------
   * FILE EXTENSION
   * --------------------------------------------------
   */

  const getFileExtension = (
    fileName: string
  ) => {
    return (
      fileName
        .split('.')
        .pop()
        ?.toUpperCase() ||
      'FILE'
    );
  };
const getFileStatus = (file: UploadedFile) => {
  if (file.status === 'processing') {
    return {
      label: 'Processing',
      className: 'text-amber-400 bg-amber-400/10',
    };
  }

  if (file.status === 'error') {
    return {
      label: 'Error',
      className: 'text-red-400 bg-red-400/10',
    };
  }

  if (file.status === 'ready') {
    return {
      label: 'Ready',
      className: 'text-slate-400 bg-slate-700/60',
    };
  }

  return {
    label: 'Completed',
    className: 'text-emerald-400 bg-emerald-400/10',
  };
};

const formatFileSize = (size: number) => {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};
  /*
   * --------------------------------------------------
   * UI
   * --------------------------------------------------
   */

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="
        bg-surface
        border
        border-slate-700/80
        rounded-2xl
        shadow-2xl
        overflow-hidden
      ">
        {/* HEADER */}

        <div className="
          px-6
          md:px-8
          py-5
          border-b
          border-slate-700/70
        ">
          <div className="
            flex
            flex-col
            md:flex-row
            md:items-center
            md:justify-between
            gap-4
          ">
            {/* TABS */}

            <div className="
              inline-flex
              w-fit
              items-center
              bg-slate-900/80
              border
              border-slate-700
              rounded-xl
              p-1
            ">
              <button
                type="button"
                onClick={() =>
                  setActiveTab('upload')
                }
                className={`
                  flex
                  items-center
                  gap-2
                  px-4
                  py-2.5
                  rounded-lg
                  text-sm
                  font-medium
                  transition-all
                  ${
                    activeTab === 'upload'
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }
                `}
              >
                <Upload className="w-4 h-4" />
                Upload Files
              </button>

              <button
                type="button"
                onClick={() =>
                  setActiveTab('paste')
                }
                className={`
                  flex
                  items-center
                  gap-2
                  px-4
                  py-2.5
                  rounded-lg
                  text-sm
                  font-medium
                  transition-all
                  ${
                    activeTab === 'paste'
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }
                `}
              >
                <ClipboardPaste className="w-4 h-4" />
                Paste Text
              </button>
            </div>

            {/* DATA TYPE */}

            <div className="
              flex
              items-center
              gap-2
            ">
              <Settings className="
                w-4
                h-4
                text-slate-500
              " />

              <select
                value={dataType}
                onChange={event =>
                  setDataType(
                    event.target.value as DataType
                  )
                }
                className="
                  bg-slate-900
                  border
                  border-slate-700
                  text-slate-200
                  text-sm
                  rounded-lg
                  px-3
                  py-2.5
                  outline-none
                  focus:border-primary
                  focus:ring-1
                  focus:ring-primary
                  transition-all
                "
              >
                <option value="auto">
                  Auto-Detect
                </option>

                {/* <option value="csv">
                  CSV
                </option>

                <option value="json">
                  JSON
                </option> */}

                <option value="whatsapp">
                  WhatsApp Log
                </option>

                {/* <option value="ai">
                  Parse with AI
                </option> */}
              </select>
            </div>
          </div>
        </div>

        {/* CONTENT */}

        <div className="
          p-6
          md:p-8
        ">
          {/* UPLOAD TAB */}

          {activeTab === 'upload' && (
            <div className="space-y-5">
              {/* DROP ZONE */}

              <div
                onClick={() =>
                  fileInputRef.current?.click()
                }
                onDragOver={
                  handleDragOver
                }
                onDragLeave={
                  handleDragLeave
                }
                onDrop={handleDrop}
                className={`
                  group
                  relative
                  min-h-[270px]
                  border-2
                  border-dashed
                  rounded-2xl
                  flex
                  flex-col
                  items-center
                  justify-center
                  text-center
                  cursor-pointer
                  transition-all
                  duration-300
                  ${
                    isDragOver
                      ? 'border-primary bg-primary/10 scale-[1.01]'
                      : 'border-slate-700 hover:border-primary/60 hover:bg-slate-800/40'
                  }
                `}
              >
                <div
                  className={`
                    w-16
                    h-16
                    rounded-2xl
                    flex
                    items-center
                    justify-center
                    mb-5
                    transition-all
                    duration-300
                    ${
                      isDragOver
                        ? 'bg-primary/20 scale-110'
                        : 'bg-slate-800 group-hover:bg-primary/10'
                    }
                  `}
                >
                  {isDragOver ? (
                    <UploadCloud className="
                      w-8
                      h-8
                      text-primary
                      animate-bounce
                    " />
                  ) : (
                    <UploadCloud className="
                      w-8
                      h-8
                      text-slate-400
                      group-hover:text-primary
                      transition-colors
                    " />
                  )}
                </div>

                <h3 className="
                  text-lg
                  font-semibold
                  text-slate-200
                  mb-2
                ">
                  {isDragOver
                    ? 'Drop your files here'
                    : 'Upload your data'}
                </h3>

                <p className="
                  text-sm
                  text-slate-500
                  max-w-md
                  px-4
                ">
                  Drag and drop one or multiple
                  files here, or click to browse.
                </p>

                <div className="
                  flex
                  items-center
                  gap-2
                  mt-5
                ">
                  {[
                    // 'CSV',
                    // 'JSON',
                    // 'TXT',
                    // 'XLSX',
                    'WhatsApp Log',
                  ].map(type => (
                    <span
                      key={type}
                      className="
                        px-2.5
                        py-1
                        rounded-md
                        bg-slate-800
                        border
                        border-slate-700
                        text-xs
                        text-slate-400
                      "
                    >
                      {type}
                    </span>
                  ))}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.csv,.json,.xlsx,.xls"
                  className="hidden"
                  onChange={
                    handleFileUpload
                  }
                />
              </div>

              {/* SELECTED FILES */}

              {selectedFiles.length > 0 && (
                <div className="
                  rounded-xl
                  border
                  border-slate-700
                  bg-slate-900/50
                  p-4
                ">
                  <div className="
                    flex
                    items-center
                    justify-between
                    mb-3
                  ">
                    <div className="
                      flex
                      items-center
                      gap-2
                    ">
                      <CheckCircle2 className="
                        w-4
                        h-4
                        text-emerald-400
                      " />

                      <span className="
                        text-sm
                        font-medium
                        text-slate-200
                      ">
                        {selectedFiles.length}{' '}
                        file
                        {selectedFiles.length !== 1
                          ? 's'
                          : ''}{' '}
                        ready
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={clearFiles}
                      disabled={isUploading}
                      className="
                        text-xs
                        text-slate-500
                        hover:text-red-400
                        transition-colors
                        disabled:opacity-50
                      "
                    >
                      Clear all
                    </button>
                  </div>

                  <div className="
                    space-y-2
                    max-h-56
                    overflow-y-auto
                    pr-1
                  ">
                    {selectedFiles.map(
                      ({ file, id }) => (
                        <div
                          key={id}
                          className="
                            flex
                            items-center
                            justify-between
                            bg-slate-800/80
                            border
                            border-slate-700
                            rounded-xl
                            px-3
                            py-3
                            group
                          "
                        >
                          <div className="
                            flex
                            items-center
                            min-w-0
                          ">
                            <div className="
                              w-9
                              h-9
                              flex
                              items-center
                              justify-center
                              bg-primary/10
                              rounded-lg
                              mr-3
                              flex-shrink-0
                            ">
                              <File className="
                                w-4
                                h-4
                                text-primary
                              " />
                            </div>

                            <div className="min-w-0">
                              <div className="
                                flex
                                items-center
                                gap-2
                              ">
                                <p className="
                                  text-sm
                                  text-slate-200
                                  truncate
                                ">
                                  {file.name}
                                </p>

                                <span className="
                                  flex-shrink-0
                                  px-1.5
                                  py-0.5
                                  rounded
                                  bg-slate-700
                                  text-[10px]
                                  text-slate-400
                                ">
                                  {getFileExtension(
                                    file.name
                                  )}
                                </span>
                              </div>

                              <p className="
                                text-xs
                                text-slate-500
                                mt-0.5
                              ">
                                {(
                                  file.size /
                                  1024
                                ).toFixed(1)}{' '}
                                KB
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeFile(id)
                            }
                            disabled={isUploading}
                            className="
                              p-2
                              text-slate-500
                              hover:text-red-400
                              hover:bg-red-400/10
                              rounded-lg
                              transition-colors
                              disabled:opacity-40
                              flex-shrink-0
                            "
                            title="Remove file"
                          >
                            <X className="
                              w-4
                              h-4
                            " />
                          </button>
                        </div>
                      )
                    )}
                  </div>

                  {/* ANALYZE */}

                  <button
                    type="button"
                    onClick={
                      handleAnalyzeFiles
                    }
                    disabled={
                      isUploading ||
                      selectedFiles.length === 0
                    }
                    className="
                      w-full
                      mt-4
                      h-12
                      btn-primary
                      rounded-xl
                      flex
                      items-center
                      justify-center
                      gap-2
                      font-medium
                      disabled:opacity-60
                      disabled:cursor-not-allowed
                      transition-all
                    "
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="
                          w-5
                          h-5
                          animate-spin
                        " />

                        <span>
                          Preparing{' '}
                          {
                            selectedFiles.length
                          }{' '}
                          file
                          {selectedFiles.length !==
                          1
                            ? 's'
                            : ''}{' '}
                          ...
                        </span>
                      </>
                    ) : (
                      <>
                        {dataType === 'ai' ? (
                          <Sparkles className="
                            w-5
                            h-5
                          " />
                        ) : (
                          <Upload className="
                            w-5
                            h-5
                          " />
                        )}

                        <span>
                          Analyze Data
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}

            </div>
          )}

          {/* PASTE TAB */}

          {activeTab === 'paste' && (
            <div className="space-y-4">
              <div className="relative">
                <textarea
                  className="
                    w-full
                    min-h-[280px]
                    bg-slate-900/70
                    border
                    border-slate-700
                    rounded-2xl
                    p-5
                    pb-12
                    text-slate-200
                    placeholder:text-slate-600
                    focus:outline-none
                    focus:border-primary
                    focus:ring-1
                    focus:ring-primary/50
                    resize-none
                    transition-all
                  "
                  placeholder="
                    Paste your WhatsApp Log
                    text data here...
                  "
                  value={text}
                  onChange={event =>
                    setText(
                      event.target.value
                    )
                  }
                />

                <div className="
                  absolute
                  bottom-4
                  left-5
                  right-5
                  flex
                  items-center
                  justify-between
                  text-xs
                  text-slate-600
                  pointer-events-none
                ">
                  <div className="
                    flex
                    items-center
                    gap-2
                  ">
                    <FileText className="
                      w-3.5
                      h-3.5
                    " />

                    <span>
                      Paste your data to begin
                    </span>
                  </div>

                  <span>
                    {text.length.toLocaleString()}{' '}
                    characters
                  </span>
                </div>
              </div>

              <div className="
                flex
                flex-col
                sm:flex-row
                sm:items-center
                sm:justify-between
                gap-3
              ">
                <div className="
                  text-xs
                  text-slate-500
                ">
                  {dataType === 'auto'
                    ? 'Format will be detected automatically.'
                    : `Using ${dataType.toUpperCase()} parser.`}
                </div>

                <button
                  type="button"
                  className="
                    btn-primary
                    h-11
                    px-5
                    rounded-xl
                    flex
                    items-center
                    justify-center
                    gap-2
                    font-medium
                    disabled:opacity-50
                    disabled:cursor-not-allowed
                    transition-all
                  "
                  onClick={
                    handlePasteSubmit
                  }
                  disabled={!text.trim()}
                >
                  {dataType === 'ai' ? (
                    <Sparkles className="
                      w-4
                      h-4
                    " />
                  ) : (
                    <Send className="
                      w-4
                      h-4
                    " />
                  )}

                  Analyze Data
                </button>
              </div>
            </div>
          )}
        </div>
                      {/* UPLOADED FILES */}

{uploadedFiles.length > 0 && (
  <div className="
    rounded-xl
    border
    border-slate-700
    bg-slate-900/50
    p-4
  ">
    <div className="
      flex
      items-center
      justify-between
      mb-3
    ">
      <div className="
        flex
        items-center
        gap-2
      ">
        <FileText className="
          w-4
          h-4
          text-primary
        " />

        <span className="
          text-sm
          font-medium
          text-slate-200
        ">
          Uploaded Files
        </span>

        <span className="
          px-1.5
          py-0.5
          rounded-md
          bg-slate-800
          border
          border-slate-700
          text-[10px]
          text-slate-500
        ">
          {uploadedFiles.length}
        </span>
      </div>
<div className="flex items-center gap-3">
  <button
    type="button"
    onClick={onSelectAllFiles}
    className="text-xs text-slate-500 hover:text-primary transition-colors"
  >
    Select all
  </button>

  <button
    type="button"
    onClick={onClearSelection}
    className="text-xs text-slate-500 hover:text-amber-400 transition-colors"
  >
    Clear selection
  </button>

  {onClearFiles && (
    <button
      type="button"
      onClick={onClearFiles}
      className="text-xs text-slate-500 hover:text-red-400 transition-colors"
    >
      Clear all
    </button>
  )}
</div>
    </div>

    <div className="
      space-y-2
      max-h-72
      overflow-y-auto
      pr-1
    ">
      {uploadedFiles.map(file => {
        const status = getFileStatus(file);
       const isSelected = selectedFileIds.includes(file.id);

        return (
          <div
            key={file.id}
            className={`
              flex
              items-center
              justify-between
              rounded-xl
              border
              px-3
              py-3
              transition-all
              ${
                isSelected
                  ? 'border-primary/60 bg-primary/5'
                  : 'border-slate-700 bg-slate-800/70 hover:border-slate-600'
              }
            `}
          >
 <input
  type="checkbox"
  checked={isSelected}
  onChange={() => onToggleFile?.(file.id)}
  disabled={file.status === 'processing'}
  className="h-4 w-4 shrink-0 accent-primary mr-3"
/>

<button
  type="button"
  onClick={() => onToggleFile?.(file.id)}
  disabled={file.status === 'processing'}
  className="
    flex
    items-center
    min-w-0
    flex-1
    text-left
    disabled:cursor-not-allowed
  "
>
              <div className={`
                w-9
                h-9
                flex
                items-center
                justify-center
                rounded-lg
                mr-3
                flex-shrink-0
                ${
                  isSelected
                    ? 'bg-primary/15'
                    : 'bg-slate-700/70'
                }
              `}>
                {file.status === 'processing' ? (
                  <Loader2 className="
                    w-4
                    h-4
                    text-primary
                    animate-spin
                  " />
                ) : file.status === 'completed' ? (
                  <CheckCircle2 className="
                    w-4
                    h-4
                    text-emerald-400
                  " />
                ) : (
                  <File className="
                    w-4
                    h-4
                    text-primary
                  " />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="
                  flex
                  items-center
                  gap-2
                  min-w-0
                ">
                  <p className="
                    text-sm
                    text-slate-200
                    truncate
                  ">
                    {file.name}
                  </p>

                  <span className="
                    flex-shrink-0
                    px-1.5
                    py-0.5
                    rounded
                    bg-slate-700
                    text-[10px]
                    text-slate-400
                  ">
                    {getFileExtension(file.name)}
                  </span>
                </div>

                <div className="
                  flex
                  items-center
                  gap-2
                  mt-1
                ">
                  <span className="
                    text-xs
                    text-slate-500
                  ">
                    {formatFileSize(file.size)}
                  </span>

                  <span
                    className={`
                      px-1.5
                      py-0.5
                      rounded
                      text-[10px]
                      font-medium
                      ${status.className}
                    `}
                  >
                    {status.label}
                  </span>
                </div>

                {file.error && (
                  <p className="
                    text-xs
                    text-red-400
                    mt-1
                    truncate
                  ">
                    {file.error}
                  </p>
                )}
              </div>
            </button>

            {onRemoveFile && (
              <button
                type="button"
                onClick={() =>
                  onRemoveFile(file.id)
                }
                className="
                  p-2
                  ml-2
                  text-slate-500
                  hover:text-red-400
                  hover:bg-red-400/10
                  rounded-lg
                  transition-colors
                  flex-shrink-0
                "
                title="Delete file"
              >
                <X className="
                  w-4
                  h-4
                " />
              </button>
            )}
          </div>
        );
      })}
    </div>
    <div className="mt-4">
  <button
    type="button"
    onClick={onAnalyzeSelected}
    disabled={selectedFileIds.length === 0}
    className="
      w-full
      h-11
      btn-primary
      rounded-xl
      flex
      items-center
      justify-center
      gap-2
      font-medium
      disabled:opacity-50
      disabled:cursor-not-allowed
      transition-all
    "
  >
    <Upload className="w-4 h-4" />
    Analyze {selectedFileIds.length} Selected File
    {selectedFileIds.length !== 1 ? 's' : ''}
  </button>
</div>
  </div>
)}
      </div>

      {/* FOOTER */}

      <div className="
        flex
        items-center
        justify-center
        gap-2
        mt-4
        text-xs
        text-slate-600
      ">
        <CheckCircle2 className="
          w-3.5
          h-3.5
        " />

        <span>
          Your data is securely processed by
          the analyzer server
        </span>
      </div>
    </div>
  );
}
