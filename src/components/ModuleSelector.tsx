'use client';

import React from 'react';
import {
  Table2,
  BarChart3,
  CalendarCheck,
  FileText,
  WalletCards,
  UsersRound,
  ChevronLeft,
  ChevronRight,
  Upload,
  Settings,
  Brain,
} from 'lucide-react';

export type AnalysisModule =
  | 'input'
  | 'raw_data'
  | 'stats'
  | 'attendance'
  | 'reports'
  | 'penalty'
  | 'employee_mapping'
  | 'uploads'
  | 'ai_settings'
  | 'ai_result';

export type UploadStatus =
  | 'ready'
  | 'processing'
  | 'completed'
  | 'error';

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'ready' | 'processing' | 'completed' | 'error';
  uploadedAt: string;
  error?: string;
}

interface ModuleSelectorProps {
  activeModule: AnalysisModule;
  onSelect: (mod: AnalysisModule) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function ModuleSelector({
  activeModule,
  onSelect,
  isCollapsed,
  onToggleCollapse,
}: ModuleSelectorProps) {
  const modules = [
    {
      id: 'input' as AnalysisModule,
      label: 'Input',
      icon: Upload,
    },
    {
      id: 'raw_data' as AnalysisModule,
      label: 'Data Viewer',
      icon: Table2,
    },
    {
      id: 'stats' as AnalysisModule,
      label: 'Column Stats',
      icon: BarChart3,
    },
    {
      id: 'attendance' as AnalysisModule,
      label: 'WhatsApp Attendance',
      icon: CalendarCheck,
    },
    {
      id: 'reports' as AnalysisModule,
      label: 'Advanced Reports',
      icon: FileText,
    },
    {
      id: 'penalty' as AnalysisModule,
      label: 'Penalty',
      icon: WalletCards,
    },
    {
      id: 'employee_mapping' as AnalysisModule,
      label: 'Employee Mapping',
      icon: UsersRound,
    },
    // {
    //   id: 'ai_result' as AnalysisModule,
    //   label: 'AI Analysis',
    //   icon: Brain,
    // },
  ];

  return (
    <div
      className={`h-full transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div
        className="fixed left-0 top-0 h-screen bg-surface border-r border-slate-700 z-40 flex flex-col transition-all duration-300"
        style={{
          width: isCollapsed ? '4rem' : '16rem',
        }}
      >
        <div
          className={`h-16 flex items-center border-b border-slate-700 flex-shrink-0 ${
            isCollapsed
              ? 'justify-center'
              : 'justify-between px-4'
          }`}
        >
          {!isCollapsed && (
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              COCO Analyzer
            </span>
          )}

          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={
              isCollapsed
                ? 'Expand sidebar'
                : 'Collapse sidebar'
            }
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-2">
          {!isCollapsed && (
            <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              Analysis
            </div>
          )}

          {modules.map(mod => {
            const Icon = mod.icon;
            const isActive =
              activeModule === mod.id;

            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => onSelect(mod.id)}
                title={
                  isCollapsed
                    ? mod.label
                    : undefined
                }
                className={`group relative w-full flex items-center rounded-xl transition-all duration-200 ${
                  isCollapsed
                    ? 'justify-center h-11'
                    : 'px-3 h-11'
                } ${
                  isActive
                    ? mod.id === 'penalty'
                      ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                      : 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />

                {!isCollapsed && (
                  <span className="ml-3 text-sm font-medium truncate">
                    {mod.label}
                  </span>
                )}

                {!isCollapsed && isActive && (
                  <span className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-700">
          <button
            type="button"
            onClick={() => onSelect('ai_settings')}
            title={
              isCollapsed
                ? 'AI Settings'
                : undefined
            }
            className={`w-full flex items-center rounded-xl transition-all duration-200 ${
              isCollapsed
                ? 'justify-center h-11'
                : 'px-3 h-11'
            } ${
              activeModule === 'ai_settings'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />

            {!isCollapsed && (
              <span className="ml-3 text-sm font-medium">
                AI Settings
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}