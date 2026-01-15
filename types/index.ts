

export enum JobStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  FINISHED = 'FINISHED',
  FAILED = 'FAILED'
}

export interface Job {
  id: string;
  name: string;
  status: JobStatus;
  timestamp: number;
  prompts: string[];
  systemInstructions?: string;
  result?: string | object;
  error?: string;
  requests: any[];
  responses: any[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'INFO' | 'ERROR' | 'API_REQUEST' | 'API_RESPONSE';
  title: string;
  data: any;
}

export enum DialogType {
  NONE = 'NONE',
  JOB_DETAILS = 'JOB_DETAILS',
  CONSOLE = 'CONSOLE',
  MARKDOWN_VIEWER = 'MARKDOWN_VIEWER',
  API_KEY = 'API_KEY',
  ALERT = 'ALERT',
  HISTORY = 'HISTORY'
}

export interface DialogState {
  isOpen: boolean;
  type: DialogType;
  data?: any;
  parentId?: string; // For stacked dialogs
}

export interface TreeItem {
  id: string;
  label: string;
  children?: TreeItem[];
  data?: any;
}

// JSON Builder Types
export interface JsonFile {
  id: string;
  name: string;
  content: any; // The raw JSON object
  mappedContent?: any; // The preview/mapped JSON
  children?: JsonFile[]; // For Grouping
}

export interface SchemaVersion {
  id: string;
  timestamp: number;
  schema: any;
  action: string; // "Analyze", "User Prompt: ...", etc.
}

export interface SchemaImprovement {
  id: string;
  title: string;
  description: string;
  category: 'Naming' | 'Structure' | 'Type' | 'Documentation' | 'Optimization' | 'Validation' | 'Extension';
}