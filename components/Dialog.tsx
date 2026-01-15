import React from 'react';
import { X, Check, Trash2, Printer } from 'lucide-react';

interface DialogProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onOk?: () => void;
  onClear?: () => void;
  onPrint?: () => void;
  okText?: string;
  isSubDialog?: boolean;
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  title,
  onClose,
  onOk,
  onClear,
  onPrint,
  okText = "OK",
  isSubDialog = false,
  children
}) => {
  if (!isOpen) return null;

  const sizeClass = isSubDialog ? 'w-[90vw] h-[90vh]' : 'w-[95vw] h-[95vh]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className={`${sizeClass} bg-dark-surface border border-purple-900 shadow-2xl rounded-lg flex flex-col text-lavender-100 overflow-hidden`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-purple-900 bg-dark-bg">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold">{title}</h2>
            {onOk && (
              <button 
                onClick={onOk}
                className="flex items-center gap-2 px-3 py-1 bg-purple-700 hover:bg-purple-600 rounded text-white text-sm transition-colors"
              >
                <Check size={16} />
                {okText}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {onPrint && (
              <button
                onClick={onPrint}
                className="flex items-center gap-2 px-3 py-1 bg-blue-900/50 hover:bg-blue-800 rounded text-blue-200 text-sm transition-colors"
              >
                <Printer size={16} />
                Print
              </button>
            )}
            {onClear && (
              <button 
                onClick={onClear}
                className="flex items-center gap-2 px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-gray-200 text-sm transition-colors"
              >
                <Trash2 size={16} />
                Clear
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-1 hover:bg-red-900/50 rounded-full transition-colors text-red-500 hover:text-red-400"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
};