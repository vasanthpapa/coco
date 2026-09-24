
'use client';

import React from 'react';
import {
  X,
  Key,
  Save,
  ShieldCheck,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string) => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  onSave,
}: SettingsModalProps) {
  if (!isOpen) {
    return null;
  }

  const handleSave = () => {
    onSave('');
    onClose();
  };

  return (
    <div className="
      fixed
      inset-0
      bg-black/60
      backdrop-blur-sm
      z-50
      flex
      items-center
      justify-center
      p-4
    ">
      <div className="
        bg-slate-900
        border border-slate-700
        rounded-2xl
        w-full
        max-w-md
        overflow-hidden
        shadow-2xl
        animate-in
        fade-in
        zoom-in-95
        duration-200
      ">
        {/* HEADER */}

        <div className="
          flex
          items-center
          justify-between
          p-6
          border-b
          border-slate-800
        ">
          <h2 className="
            text-xl
            font-bold
            flex
            items-center
          ">
            <Key className="
              w-5 h-5
              mr-2
              text-primary
            " />

            AI Settings
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="
              text-slate-400
              hover:text-white
              transition-colors
            "
            aria-label="Close settings"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* CONTENT */}

        <div className="p-6 space-y-5">
          <div className="
            flex
            items-start
            gap-3
            p-4
            rounded-xl
            bg-emerald-500/10
            border
            border-emerald-500/20
          ">
            <ShieldCheck className="
              w-5 h-5
              text-emerald-400
              flex-shrink-0
              mt-0.5
            " />

            <div>
              <p className="
                text-sm
                font-medium
                text-emerald-300
              ">
                Server-side AI configuration
              </p>

              <p className="
                text-xs
                text-slate-400
                mt-1
                leading-relaxed
              ">
                Your Gemini API key is now handled
                by the analyzer server and is not
                stored in your browser.
              </p>
            </div>
          </div>

          <div>
            <label className="
              block
              text-sm
              font-medium
              text-slate-300
              mb-2
            ">
              Gemini API Key
            </label>

            <div className="
              w-full
              bg-slate-800/70
              border
              border-slate-700
              rounded-lg
              px-3
              py-3
              text-sm
              text-slate-500
            ">
              Configured on server
            </div>

            <p className="
              text-xs
              text-slate-500
              mt-2
            ">
              The API key is managed through the
              server environment configuration.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="
              w-full
              btn-primary
              flex
              items-center
              justify-center
              py-3
              rounded-lg
            "
          >
            <Save className="
              w-4 h-4
              mr-2
            " />

            Done
          </button>
        </div>
      </div>
    </div>
  );
}