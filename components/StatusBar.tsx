import React, { useState } from 'react';
import { useJobs } from '../hooks/useJobs';
import { JobStatus, Job } from '../types';
import { Play, RotateCw, CheckCircle, XCircle } from 'lucide-react';
import { JobDialog } from './JobDialog';

export const StatusBar: React.FC = () => {
  const { pending, running, finished, failed, cancelJob, deleteJob, retryJob, prioritizeJob } = useJobs();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const StatusCounter = ({ label, count, color, jobs, status }: { label: string, count: number, color: string, jobs: Job[], status: JobStatus }) => {
     const [showMenu, setShowMenu] = useState(false);

     return (
         <div className="relative">
             <button 
                onClick={() => setShowMenu(!showMenu)}
                className={`flex items-center gap-2 px-3 py-1 text-sm font-medium hover:bg-white/10 rounded transition-colors ${color}`}
             >
                 {label}: {count}
             </button>
             {showMenu && (
                 <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                    {/* Position upwards (bottom-full) to prevent going offscreen */}
                    <div className="absolute bottom-full mb-2 left-0 w-64 bg-dark-surface border border-purple-900 rounded shadow-xl z-20 flex flex-col py-1">
                        <div className="px-3 py-2 text-xs font-bold text-gray-500 border-b border-purple-900 uppercase">Top 10 {label}</div>
                        {jobs.slice(0, 10).map(job => (
                            <div key={job.id} className="group relative px-3 py-2 hover:bg-purple-900/30 text-sm flex justify-between items-center">
                                <span className="truncate w-32">{job.name}</span>
                                <div className="hidden group-hover:flex gap-1">
                                    <button onClick={() => { setSelectedJob(job); setShowMenu(false); }} className="text-blue-400 hover:text-blue-300 px-1 text-xs">Show</button>
                                    
                                    {status === JobStatus.PENDING && (
                                        <>
                                            <button onClick={() => cancelJob(job.id)} className="text-red-400 hover:text-red-300 px-1 text-xs">Cancel</button>
                                            <button onClick={() => prioritizeJob(job.id)} className="text-green-400 hover:text-green-300 px-1 text-xs">^</button>
                                        </>
                                    )}
                                    {(status === JobStatus.FINISHED || status === JobStatus.FAILED) && (
                                        <button onClick={() => deleteJob(job.id)} className="text-red-400 hover:text-red-300 px-1 text-xs">Del</button>
                                    )}
                                    {status === JobStatus.FAILED && (
                                        <button onClick={() => retryJob(job.id)} className="text-yellow-400 hover:text-yellow-300 px-1 text-xs">Retry</button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {jobs.length === 0 && <div className="px-3 py-2 text-gray-500 text-sm italic">No jobs</div>}
                    </div>
                 </>
             )}
         </div>
     )
  }

  return (
    <div className="h-8 bg-dark-bg border-t border-purple-900 flex items-center px-4 gap-4 select-none">
      <StatusCounter label="Pending" count={pending.length} color="text-yellow-400" jobs={pending} status={JobStatus.PENDING} />
      <StatusCounter label="Running" count={running.length} color="text-blue-400" jobs={running} status={JobStatus.RUNNING} />
      <StatusCounter label="Finished" count={finished.length} color="text-green-400" jobs={finished} status={JobStatus.FINISHED} />
      <StatusCounter label="Failed" count={failed.length} color="text-red-400" jobs={failed} status={JobStatus.FAILED} />
      
      <JobDialog isOpen={!!selectedJob} job={selectedJob} onClose={() => setSelectedJob(null)} />
    </div>
  );
};