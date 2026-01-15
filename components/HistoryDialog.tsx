import React, { useState, useEffect } from 'react';
import { Dialog } from './Dialog';
import { jsonBuilderService } from '../services/jsonBuilder.service';
import { SchemaVersion } from '../types';
import { RotateCcw, Clock } from 'lucide-react';

interface HistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HistoryDialog: React.FC<HistoryDialogProps> = ({ isOpen, onClose }) => {
  const [history, setHistory] = useState<SchemaVersion[]>([]);

  useEffect(() => {
    if (isOpen) {
        setHistory(jsonBuilderService.getHistory());
    }
  }, [isOpen]);

  const handleRestore = (id: string) => {
    jsonBuilderService.restoreVersion(id);
    onClose();
  };

  return (
    <Dialog isOpen={isOpen} title="Schema Version History" onClose={onClose} onOk={onClose} okText="Close">
      <div className="flex flex-col h-full gap-2 p-4">
        {history.length === 0 && <p className="text-gray-500 italic">No history available yet.</p>}
        {history.map((ver, idx) => (
            <div key={ver.id} className="flex items-center justify-between p-3 bg-dark-surface border border-purple-900 rounded hover:bg-purple-900/20">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 text-sm font-bold text-lavender-100">
                        <Clock size={14} />
                        {new Date(ver.timestamp).toLocaleString()}
                        {idx === 0 && <span className="text-xs bg-green-900 text-green-200 px-1 rounded">Current</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{ver.action}</div>
                </div>
                <button 
                    onClick={() => handleRestore(ver.id)}
                    className="flex items-center gap-1 px-3 py-1 bg-blue-900/50 hover:bg-blue-800 text-blue-200 rounded text-xs border border-blue-900"
                >
                    <RotateCcw size={12} /> Restore
                </button>
            </div>
        ))}
      </div>
    </Dialog>
  );
};