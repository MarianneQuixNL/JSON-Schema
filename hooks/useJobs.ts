import { useState, useEffect } from 'react';
import { jobManager } from '../services/jobManager.service';
import { Job } from '../types';

export const useJobs = () => {
  const [jobs, setJobs] = useState<Job[]>(jobManager.getJobs());

  useEffect(() => {
    return jobManager.subscribe(setJobs);
  }, []);

  return {
    jobs,
    pending: jobs.filter(j => j.status === 'PENDING'),
    running: jobs.filter(j => j.status === 'RUNNING'),
    finished: jobs.filter(j => j.status === 'FINISHED'),
    failed: jobs.filter(j => j.status === 'FAILED'),
    addJob: jobManager.addJob.bind(jobManager),
    cancelJob: jobManager.cancelJob.bind(jobManager),
    deleteJob: jobManager.deleteJob.bind(jobManager),
    retryJob: jobManager.retryJob.bind(jobManager),
    prioritizeJob: jobManager.prioritizeJob.bind(jobManager),
    getJob: jobManager.getJob.bind(jobManager),
  };
};