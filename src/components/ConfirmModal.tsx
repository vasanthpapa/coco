'use client';

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export default function ConfirmModal({
  isOpen,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  danger = true,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Close */}
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6">
          {/* Icon */}
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${
              danger
                ? 'bg-red-500/10 text-red-400'
                : 'bg-primary/10 text-primary'
            }`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>

          {/* Content */}
          <h2 className="text-xl font-semibold text-white mb-2">
            {title}
          </h2>

          <p className="text-sm text-slate-400 leading-relaxed">
            {message}
          </p>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-7">
            <button
              onClick={onCancel}
              className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            >
              {cancelText}
            </button>

            <button
              onClick={onConfirm}
              className={`px-4 py-2.5 rounded-lg text-white transition ${
                danger
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-primary hover:bg-primary/90'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
