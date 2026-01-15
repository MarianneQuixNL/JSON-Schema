import { Job, JobStatus } from '../types';
import { logger } from './logger.service';

const MAX_RUNNING_JOBS = 5;

type JobExecutor = (job: Job) => Promise<any>;

class JobManager {
  private jobs: Job[] = [];
  private executors: Map<string, JobExecutor> = new Map();
  private listeners: ((jobs: Job[]) => void)[] = [];
  private intervalId: any;

  constructor() {
    // Start the job processor loop
    this.intervalId = setInterval(() => this.processQueue(), 1000);
  }

  addJob(name: string, prompts: string[], executor: JobExecutor, systemInstructions?: string): string {
    const job: Job = {
      id: crypto.randomUUID(),
      name,
      status: JobStatus.PENDING,
      timestamp: Date.now(),
      prompts,
      systemInstructions,
      requests: [],
      responses: []
    };
    this.jobs.push(job);
    this.executors.set(job.id, executor);
    
    logger.log('INFO', `Job added: ${name}`, { jobId: job.id });
    this.notify();
    return job.id;
  }

  getJobs(): Job[] {
    return this.jobs;
  }

  getJob(id: string): Job | undefined {
    return this.jobs.find(j => j.id === id);
  }

  cancelJob(id: string) {
    const job = this.jobs.find(j => j.id === id);
    if (job && job.status === JobStatus.PENDING) {
      this.jobs = this.jobs.filter(j => j.id !== id);
      this.executors.delete(id);
      logger.log('INFO', `Job cancelled: ${job.name}`, null);
      this.notify();
    }
  }

  deleteJob(id: string) {
    const job = this.jobs.find(j => j.id === id);
    if (job && (job.status === JobStatus.FINISHED || job.status === JobStatus.FAILED)) {
      this.jobs = this.jobs.filter(j => j.id !== id);
      this.executors.delete(id);
      this.notify();
    }
  }

  retryJob(id: string) {
    const job = this.jobs.find(j => j.id === id);
    if (job && job.status === JobStatus.FAILED) {
      job.status = JobStatus.PENDING;
      job.error = undefined;
      job.result = undefined;
      job.timestamp = Date.now();
      logger.log('INFO', `Job retried: ${job.name}`, null);
      this.notify();
    }
  }

  prioritizeJob(id: string) {
    const index = this.jobs.findIndex(j => j.id === id);
    if (index > 0 && this.jobs[index].status === JobStatus.PENDING) {
      const job = this.jobs.splice(index, 1)[0];
      const firstPendingIndex = this.jobs.findIndex(j => j.status === JobStatus.PENDING);
      if (firstPendingIndex === -1) {
        this.jobs.push(job);
      } else {
        this.jobs.splice(firstPendingIndex, 0, job);
      }
      this.notify();
    }
  }

  subscribe(listener: (jobs: Job[]) => void) {
    this.listeners.push(listener);
    listener(this.jobs);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l([...this.jobs]));
  }

  private async processQueue() {
    const runningCount = this.jobs.filter(j => j.status === JobStatus.RUNNING).length;
    if (runningCount >= MAX_RUNNING_JOBS) return;

    const nextJob = this.jobs.find(j => j.status === JobStatus.PENDING);
    if (!nextJob) return;

    nextJob.status = JobStatus.RUNNING;
    this.notify();

    this.executeJob(nextJob);
  }

  private async executeJob(job: Job) {
    logger.log('INFO', `Starting execution of ${job.name}`, { jobId: job.id });
    
    const executor = this.executors.get(job.id);
    if (!executor) {
        job.status = JobStatus.FAILED;
        job.error = "Internal Error: Executor not found for job";
        this.notify();
        return;
    }

    try {
      const result = await executor(job);
      job.result = result;
      job.status = JobStatus.FINISHED;
      logger.log('INFO', `Job finished: ${job.name}`, null);
    } catch (e: any) {
      job.error = e.message || "Unknown error";
      job.status = JobStatus.FAILED;
      logger.log('ERROR', `Job failed: ${job.name}`, e);
    } finally {
      this.executors.delete(job.id); // Cleanup
      this.notify();
    }
  }
}

export const jobManager = new JobManager();