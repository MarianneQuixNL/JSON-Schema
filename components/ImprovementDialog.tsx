
import React, { useState, useEffect } from 'react';
import { Dialog } from './Dialog';
import { SchemaImprovement } from '../types';
import { Sparkles, CheckSquare, Square } from 'lucide-react';
import { Spinner } from './Spinner';

interface ImprovementDialogProps {
  isOpen: boolean;
  improvements: SchemaImprovement[];
  onApply: (selectedIds: string[]) => void;
  onClose: () => void;
  isProcessing: boolean;
}

export const ImprovementDialog: React.FC<ImprovementDialogProps> = ({ isOpen, improvements, onApply, onClose, isProcessing }) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [timer, setTimer] = useState(0);

  // Reset selection when dialog opens
  useEffect(() => {
    if (isOpen) {
        setSelectedIds(new Set(improvements.map(i => i.id)));
    }
  }, [isOpen, improvements]);

  // Timer logic
  useEffect(() => {
    let interval: any;
    if (isProcessing) {
      setTimer(0);
      interval = setInterval(() => {
        setTimer(t => t + 1);
      }, 1000);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  const toggleSelection = (id: string) => {
    if (isProcessing) return;
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleApply = () => {
    if (isProcessing) return;
    onApply(Array.from(selectedIds));
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const getCategoryColor = (cat: string) => {
      switch(cat) {
          case 'Naming': return 'bg-blue-900 text-blue-200 border-blue-700';
          case 'Structure': return 'bg-purple-900 text-purple-200 border-purple-700';
          case 'Type': return 'bg-yellow-900 text-yellow-200 border-yellow-700';
          case 'Validation': return 'bg-red-900 text-red-200 border-red-700';
          case 'Documentation': return 'bg-green-900 text-green-200 border-green-700';
          case 'Optimization': return 'bg-orange-900 text-orange-200 border-orange-700';
          case 'Extension': return 'bg-pink-900 text-pink-200 border-pink-700';
          default: return 'bg-gray-800 text-gray-300 border-gray-600';
      }
  };

  const title = isProcessing 
    ? `Applying Changes... (${formatTime(timer)})` 
    : "Schema Improvements";

  return (
    <Dialog 
        isOpen={isOpen} 
        title={title} 
        onClose={() => { if(!isProcessing) onClose(); }} 
        onOk={handleApply} 
        okText={isProcessing ? "Processing..." : `Apply Selected (${selectedIds.size})`}
    >
        <div className="flex flex-col h-full bg-dark-bg p-4 overflow-hidden relative">
            {isProcessing && (
                <div className="absolute inset-0 z-10 bg-black/70 flex flex-col items-center justify-center backdrop-blur-sm">
                    <Spinner size={100} color="rainbow" />
                    <p className="mt-6 text-xl text-white font-bold animate-pulse">AI is thinking...</p>
                    <p className="text-sm text-gray-300 mt-2">Updating schema and analyzing next steps</p>
                </div>
            )}

            <div className="mb-4 bg-purple-900/20 border border-purple-900 p-4 rounded text-lavender-100 flex items-start gap-4">
                <Sparkles className="text-yellow-400 mt-1" size={24} />
                <div>
                    <h3 className="font-bold">AI Analysis Complete</h3>
                    <p className="text-sm text-gray-300">The following improvements have been identified to enhance your schema structure, documentation, and data integrity. Select the ones you wish to apply.</p>
                </div>
            </div>

            <div className="flex-1 overflow-auto space-y-2">
                {improvements.length === 0 && (
                    <div className="text-center text-gray-500 italic mt-8">No improvements found. Your schema looks great!</div>
                )}
                {improvements.map(imp => {
                    const isSelected = selectedIds.has(imp.id);
                    return (
                        <div 
                            key={imp.id}
                            className={`p-3 rounded border cursor-pointer transition-colors flex items-start gap-3 ${isSelected ? 'bg-purple-900/30 border-purple-500' : 'bg-dark-surface border-gray-700 hover:border-gray-600'}`}
                            onClick={() => toggleSelection(imp.id)}
                        >
                            <div className="mt-1">
                                {isSelected ? <CheckSquare className="text-purple-400" size={20} /> : <Square className="text-gray-600" size={20} />}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-xs px-2 py-0.5 rounded border font-bold ${getCategoryColor(imp.category)}`}>
                                        {imp.category}
                                    </span>
                                    <span className="font-bold text-gray-200">{imp.title}</span>
                                </div>
                                <p className="text-sm text-gray-400">{imp.description}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            <div className="mt-4 flex justify-between items-center text-xs text-gray-500 px-2">
                <button onClick={() => !isProcessing && setSelectedIds(new Set())} className={`hover:text-white ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}>Deselect All</button>
                <button onClick={() => !isProcessing && setSelectedIds(new Set(improvements.map(i => i.id)))} className={`hover:text-white ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}>Select All</button>
            </div>
        </div>
    </Dialog>
  );
};
