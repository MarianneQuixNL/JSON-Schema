import React, { useState } from 'react';
import { Dialog } from './Dialog';
import { Job, JobStatus } from '../types';
import { Copy, Download, Activity, Play, RefreshCw, Trash2 } from 'lucide-react';
import { jobManager } from '../services/jobManager.service';
import { geminiService } from '../services/gemini.service';
import { ERROR_ANALYSIS_PROMPT } from '../constants/prompts';

interface JobDialogProps {
  isOpen: boolean;
  job: Job | null;
  onClose: () => void;
}

export const JobDialog: React.FC<JobDialogProps> = ({ isOpen, job, onClose }) => {
  const [activeTab, setActiveTab] = useState('Prompts');
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState('');

  if (!job) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleDownload = () => {
    const content = `# Job: ${job.name}\nTimestamp: ${new Date(job.timestamp).toLocaleString()}\n\n## Result\n${JSON.stringify(job.result, null, 2)}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `job_${job.name}_${job.timestamp}.md`;
    a.click();
  };

  const handleAnalyzeError = async () => {
    if (!job.error) return;
    try {
        await geminiService.generateContent('gemini-1.5-flash', `${ERROR_ANALYSIS_PROMPT}\nError: ${job.error}\nPrompt: ${job.prompts.join('\n')}`);
        // In a real app, we'd append this analysis to the job or show a new dialog.
        setAnalysisMessage("Analysis sent to logs (Simulation)");
        setAnalysisOpen(true);
    } catch (e) {
        setAnalysisMessage("Failed to analyze error");
        setAnalysisOpen(true);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'Prompts':
        return (
          <div className="space-y-4">
            {job.systemInstructions && (
              <div className="p-4 bg-dark-bg border border-purple-900 rounded">
                <div className="flex justify-between mb-2">
                  <h3 className="text-sm font-bold text-gray-400">System Instructions</h3>
                  <button onClick={() => handleCopy(job.systemInstructions!)}><Copy size={14}/></button>
                </div>
                <pre className="font-mono text-sm whitespace-pre-wrap">{job.systemInstructions}</pre>
              </div>
            )}
            {job.prompts.map((p, i) => (
              <div key={i} className="p-4 bg-dark-bg border border-purple-900 rounded">
                <div className="flex justify-between mb-2">
                  <h3 className="text-sm font-bold text-gray-400">Prompt {i + 1}</h3>
                  <button onClick={() => handleCopy(p)}><Copy size={14}/></button>
                </div>
                <pre className="font-mono text-sm whitespace-pre-wrap">{p}</pre>
              </div>
            ))}
          </div>
        );
      case 'Result':
        return (
          <div className="p-4 h-full bg-white text-black rounded overflow-auto font-mono text-sm">
             {typeof job.result === 'string' ? job.result : JSON.stringify(job.result, null, 2)}
          </div>
        );
      case 'Error':
        if (job.status !== JobStatus.FAILED) return <div className="p-4">No errors.</div>;
        return (
          <div className="p-4 space-y-4">
            <div className="p-4 bg-red-900/20 border border-red-900 rounded text-red-200">
               {job.error}
            </div>
            <button 
                onClick={handleAnalyzeError}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-600 rounded text-white flex gap-2 items-center"
            >
                <Activity size={16} /> Analyze Error with AI
            </button>
          </div>
        );
      case 'Requests':
         return (
             <div className="space-y-2">
                 {job.requests.map((r, i) => (
                     <div key={i} className="p-2 bg-dark-bg font-mono text-xs border border-gray-800">
                         {JSON.stringify(r, null, 2)}
                     </div>
                 ))}
             </div>
         );
      case 'Responses':
        return (
            <div className="space-y-2">
                {job.responses.map((r, i) => (
                    <div key={i} className="p-2 bg-dark-bg font-mono text-xs border border-gray-800">
                        {JSON.stringify(r, null, 2)}
                    </div>
                ))}
            </div>
        );
      default: return null;
    }
  };

  return (
    <>
        <Dialog isOpen={isOpen} title={`Job: ${job.name}`} onClose={onClose} onOk={() => handleDownload()} okText="Download">
          <div className="flex h-full">
            {/* Sidebar */}
            <div className="w-48 bg-dark-bg border-r border-purple-900 flex flex-col">
              {['Prompts', 'Result', 'Error', 'Requests', 'Responses'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-left px-4 py-3 text-sm hover:bg-purple-900/30 ${activeTab === tab ? 'bg-purple-900/50 text-white font-medium' : 'text-gray-400'}`}
                  disabled={tab === 'Error' && job.status !== JobStatus.FAILED}
                >
                  {tab}
                </button>
              ))}
            </div>
            
            {/* Content */}
            <div className="flex-1 p-4 overflow-auto bg-dark-surface">
                {renderContent()}
            </div>
          </div>
        </Dialog>
        
        <Dialog 
            isOpen={analysisOpen} 
            title="Analysis" 
            onClose={() => setAnalysisOpen(false)}
            onOk={() => setAnalysisOpen(false)}
            okText="Close"
            isSubDialog
        >
            <div className="p-6 flex items-center justify-center">
                <p>{analysisMessage}</p>
            </div>
        </Dialog>
    </>
  );
};