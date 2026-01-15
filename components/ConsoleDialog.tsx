import React, { useState, useEffect } from 'react';
import { Dialog } from './Dialog';
import { logger } from '../services/logger.service';
import { LogEntry } from '../types';
import { Copy, Download, ChevronRight, ChevronDown } from 'lucide-react';

interface ConsoleDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConsoleDialog: React.FC<ConsoleDialogProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'ALL' | 'API' | 'ERROR'>('ALL');

  useEffect(() => {
    return logger.subscribe(setLogs);
  }, []);

  const handleDownload = () => {
    const content = logs.map(l => `[${l.timestamp}] [${l.type}] ${l.title}\n${JSON.stringify(l.data, null, 2)}`).join('\n\n');
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `console_logs_${Date.now()}.md`;
    a.click();
  };

  const filteredLogs = logs.filter(l => {
    if (activeTab === 'API') return l.type === 'API_REQUEST' || l.type === 'API_RESPONSE';
    if (activeTab === 'ERROR') return l.type === 'ERROR';
    return true;
  });

  return (
    <Dialog isOpen={isOpen} title="Console" onClose={onClose} onOk={onClose} okText="Close">
      <div className="flex flex-col h-full">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-2 bg-dark-bg border-b border-purple-900">
          <div className="flex gap-2">
            {['ALL', 'API', 'ERROR'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-3 py-1 rounded text-sm ${activeTab === tab ? 'bg-purple-700 text-white' : 'bg-slate-800 text-gray-400 hover:bg-slate-700'}`}
              >
                {tab}
              </button>
            ))}
          </div>
          <button onClick={handleDownload} className="flex items-center gap-2 px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm">
            <Download size={14} /> Download Markdown
          </button>
        </div>

        {/* Logs */}
        <div className="flex-1 overflow-auto p-4 space-y-2">
          {filteredLogs.map(log => (
            <LogItem key={log.id} log={log} />
          ))}
        </div>
      </div>
    </Dialog>
  );
};

const LogItem: React.FC<{ log: LogEntry }> = ({ log }) => {
  const [expanded, setExpanded] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
  };

  return (
    <div className="border border-purple-900/50 rounded bg-dark-surface">
      <div 
        className="flex items-center justify-between p-2 cursor-pointer hover:bg-purple-900/20"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="text-xs text-gray-500 font-mono">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
          <span className={`text-xs font-bold px-1 rounded ${
            log.type === 'ERROR' ? 'bg-red-900 text-red-200' : 
            log.type === 'API_REQUEST' ? 'bg-blue-900 text-blue-200' :
            'bg-gray-800 text-gray-300'
          }`}>{log.type}</span>
          <span className="text-sm font-medium truncate text-lavender-50">{log.type === 'ERROR' ? (log.data?.message || log.title) : log.title}</span>
        </div>
        <button onClick={(e) => { e.stopPropagation(); copyToClipboard(); }} className="p-1 text-gray-500 hover:text-white">
          <Copy size={14} />
        </button>
      </div>
      {expanded && (
        <div className="p-2 border-t border-purple-900/30 bg-black/20">
          <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap break-all">
            {JSON.stringify(log.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};