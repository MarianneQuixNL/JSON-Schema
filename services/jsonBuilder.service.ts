

import { JsonFile, SchemaVersion, SchemaImprovement } from '../types';
import { logger } from './logger.service';

const MAX_HISTORY = 25;
const STORAGE_KEY = 'katje_workspace_v1';

// Default JSON Schema Stub
const DEFAULT_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Generated Schema",
  "type": "object",
  "properties": {}
};

class JsonBuilderService {
  private files: JsonFile[] = [];
  private selectedFileId: string | null = null;
  private targetSchema: any = JSON.parse(JSON.stringify(DEFAULT_SCHEMA));
  private schemaName: string = "DataSchema";
  private selectedSchemaPath: string[] = []; // Path to selected node in schema
  private history: SchemaVersion[] = [];
  private clipboard: { mode: 'copy' | 'cut', path: string[], data: any } | null = null;
  private listeners: (() => void)[] = [];
  
  // Cache for suggestions linked to the schema name. 
  private improvementCache: Map<string, SchemaImprovement[]> = new Map();

  constructor() {
    this.loadState();
  }

  // File Management
  async addFiles(fileList: FileList) {
    const validFiles = Array.from(fileList).filter(f => 
        f.type === "application/json" || f.name.toLowerCase().endsWith('.json')
    );

    if (validFiles.length === 0) return;

    // Helper to read file asynchronously
    const readFile = (file: File): Promise<JsonFile | null> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = JSON.parse(e.target?.result as string);
                    resolve({
                        id: crypto.randomUUID(),
                        name: file.name,
                        content
                    });
                } catch (err) {
                    logger.log('ERROR', `Failed to parse JSON: ${file.name}`, err);
                    resolve(null);
                }
            };
            reader.readAsText(file);
        });
    };

    // Read all files
    const loadedFiles = (await Promise.all(validFiles.map(readFile))).filter(f => f !== null) as JsonFile[];

    if (loadedFiles.length === 0) return;

    if (loadedFiles.length === 1) {
        // Single file: Add normally
        this.files.push(loadedFiles[0]);
        logger.log('INFO', `File added: ${loadedFiles[0].name}`, null);
    } else {
        // Multiple files: Create a Group
        const groupName = this.generateNextGroupName();
        const newGroup: JsonFile = {
            id: crypto.randomUUID(),
            name: groupName,
            content: null,
            children: loadedFiles
        };
        this.files.push(newGroup);
        logger.log('INFO', `Created ${groupName} with ${loadedFiles.length} files`, null);
    }

    this.saveState();
    this.notify();
  }

  // Direct method to add file from object, returns ID
  addFile(name: string, content: any): string {
    const id = crypto.randomUUID();
    const newFile: JsonFile = {
      id,
      name,
      content
    };
    this.files.push(newFile);
    logger.log('INFO', `File added: ${name}`, null);
    this.saveState();
    this.notify();
    return id;
  }

  private findFileAndParent(id: string, list: JsonFile[], parent: JsonFile | null = null): { file: JsonFile | undefined, parent: JsonFile | null } {
      for (const f of list) {
          if (f.id === id) return { file: f, parent };
          if (f.children) {
              const result = this.findFileAndParent(id, f.children, f);
              if (result.file) return result;
          }
      }
      return { file: undefined, parent: null };
  }

  private generateNextGroupName(): string {
      const allFiles = this.getAllFilesFlat();
      let max = 0;
      const regex = /^Group (\d+)$/i;
      for (const f of allFiles) {
          const match = f.name.match(regex);
          if (match) {
              const num = parseInt(match[1]);
              if (!isNaN(num) && num > max) max = num;
          }
      }
      return `Group ${max + 1}`;
  }

  // Grouping Logic: Container Based
  groupFiles(targetId: string, sourceId: string) {
    if (targetId === sourceId) return;

    // 1. Find and Remove Source
    const sourceData = this.findFileAndParent(sourceId, this.files);
    if (!sourceData.file) return;
    const sourceFile = sourceData.file;

    // Remove from old location
    if (sourceData.parent) {
        if (sourceData.parent.children) {
            sourceData.parent.children = sourceData.parent.children.filter(f => f.id !== sourceId);
        }
    } else {
        this.files = this.files.filter(f => f.id !== sourceId);
    }

    // 2. Find Target
    const targetData = this.findFileAndParent(targetId, this.files);
    if (!targetData.file) {
        // Fallback: put source back at root
        this.files.push(sourceFile);
        return;
    }

    const targetFile = targetData.file;
    const targetParent = targetData.parent;

    // 3. Logic
    if (targetFile.children) {
        // Target is already a group -> Add source to it
        targetFile.children.push(sourceFile);
        logger.log('INFO', `Moved ${sourceFile.name} into ${targetFile.name}`, null);
    } else {
        // Target is a file -> Create new container group
        const groupName = this.generateNextGroupName();
        const newGroup: JsonFile = {
            id: crypto.randomUUID(),
            name: groupName,
            content: null,
            children: [targetFile, sourceFile]
        };

        // Replace target with newGroup
        if (targetParent) {
            if (targetParent.children) {
                const idx = targetParent.children.findIndex(f => f.id === targetId);
                if (idx !== -1) targetParent.children[idx] = newGroup;
            }
        } else {
            const idx = this.files.findIndex(f => f.id === targetId);
            if (idx !== -1) this.files[idx] = newGroup;
        }
        logger.log('INFO', `Created ${groupName} containing ${targetFile.name} and ${sourceFile.name}`, null);
    }
    
    this.saveState();
    this.notify();
  }

  // Get Flattened list of ALL files (for bulk operations)
  getAllFilesFlat(): JsonFile[] {
      const result: JsonFile[] = [];
      const traverse = (list: JsonFile[]) => {
          for (const f of list) {
              result.push(f);
              if (f.children) traverse(f.children);
          }
      }
      traverse(this.files);
      return result;
  }

  // Schema Detection & Loading
  isJsonSchema(json: any): boolean {
    if (typeof json !== 'object' || json === null) return false;
    // Basic heuristic: check for $schema or top-level type/properties combo
    if (json.$schema) return true;
    if (json.definitions && (json.type || json.properties)) return true;
    if (json.type && (json.properties || json.items)) return true;
    if (json.title && json.type === 'object') return true;
    return false;
  }

  loadSchema(schema: any, name: string) {
      this.updateSchema(schema, `Loaded schema: ${name}`);
      // Strip extension if present
      const cleanName = name.replace(/\.json$/i, '');
      this.setSchemaName(cleanName);
  }

  getFiles() { return this.files; }
  
  selectFile(id: string | null) {
    // Treat empty string or null as clearing selection
    this.selectedFileId = id || null;
    this.notify();
  }

  getSelectedFile() {
    // Need recursive search now
    const find = (list: JsonFile[]): JsonFile | undefined => {
        for(const f of list) {
            if (f.id === this.selectedFileId) return f;
            if (f.children) {
                const found = find(f.children);
                if (found) return found;
            }
        }
        return undefined;
    };
    return find(this.files);
  }

  // For Analysis: If group, get array of contents recursively
  getAggregateContent(file: JsonFile): any {
      // If regular file with no children property, return content
      if (!file.children) return file.content;
      
      const samples: any[] = [];
      const traverse = (f: JsonFile) => {
          if (f.content) samples.push(f.content);
          if (f.children) f.children.forEach(traverse);
      };
      
      // If it's a group, traverse its children
      if (file.children) file.children.forEach(traverse);
      
      // Also include own content if present (safeguard)
      if (file.content) samples.push(file.content);

      return samples;
  }

  // Schema Management
  getSchema() { return this.targetSchema; }
  
  getSchemaName() { return this.schemaName; }
  
  setSchemaName(name: string) { 
      this.improvementCache.delete(this.schemaName); 
      this.schemaName = name; 
      this.saveState();
      this.notify();
  }

  updateSchema(newSchema: any, action: string) {
    try {
      JSON.stringify(newSchema);
      
      this.history.unshift({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        schema: JSON.parse(JSON.stringify(this.targetSchema)),
        action
      });
      
      if (this.history.length > MAX_HISTORY) {
        this.history.pop();
      }

      this.targetSchema = newSchema;
      
      // Invalidate mappings (Deep traversal needed or just clear all known)
      this.getAllFilesFlat().forEach(f => f.mappedContent = undefined);
      
      this.improvementCache.delete(this.schemaName);

      logger.log('INFO', `Schema updated: ${action}`, null);
      this.saveState();
      this.notify();
    } catch (e) {
      logger.log('ERROR', 'Failed to update schema (Circular reference detected)', e);
    }
  }

  // Schema Selection & manipulation
  setSelectedSchemaPath(path: string[]) {
    this.selectedSchemaPath = path;
  }
  
  getSelectedSchemaPath() {
      return this.selectedSchemaPath;
  }

  // Infer JSON Schema type from value
  private inferSchemaType(value: any): any {
    if (value === null) return { type: "null", description: "Nullable field" };
    if (Array.isArray(value)) return { type: "array", description: "List of items", items: value.length > 0 ? this.inferSchemaType(value[0]) : {} };
    if (typeof value === 'object') return { type: "object", description: "Object container", properties: {} };
    if (typeof value === 'number') return { type: "number", description: "Numeric value" };
    if (typeof value === 'boolean') return { type: "boolean", description: "Boolean flag" };
    return { type: "string", description: "Text field" };
  }

  addFragmentToSchema(fragment: any, key: string, targetPath?: string[]) {
    const newSchema = JSON.parse(JSON.stringify(this.targetSchema));
    
    const path = targetPath || this.selectedSchemaPath;
    let target = this.navigateSchema(newSchema, path);

    if (!target) {
        target = newSchema; 
    }

    if (target.type === 'object' || target.properties) {
        if (!target.properties) target.properties = {};
        target.properties[key] = this.inferSchemaType(fragment);
    } else if (target.type === 'array' || target.items) {
        target.items = this.inferSchemaType(fragment);
    } else {
        if (path.length === 0) {
            if (!newSchema.properties) newSchema.properties = {};
            newSchema.properties[key] = this.inferSchemaType(fragment);
        } else {
            logger.log('ERROR', 'Cannot add child to non-object node', null);
            return;
        }
    }

    this.updateSchema(newSchema, `Added node: ${key}`);
  }

  addNode(type: string, key: string) {
      const description = `Description for ${key}`;
      const template = type === 'object' ? { type: 'object', description, properties: {} } :
                       type === 'array' ? { type: 'array', description, items: {} } :
                       { type, description };
      
      const newSchema = JSON.parse(JSON.stringify(this.targetSchema));
      let target = this.navigateSchema(newSchema, this.selectedSchemaPath);
      if (!target) target = newSchema;
      
      if (target.properties) {
          target.properties[key] = template;
      } else if (target.items) {
          target.items = template; 
      } else if (this.selectedSchemaPath.length === 0) {
           if (!newSchema.properties) newSchema.properties = {};
           newSchema.properties[key] = template;
      }
      
      this.updateSchema(newSchema, `Added ${type}: ${key}`);
  }
  
  renameNode(path: string[], newName: string) {
      if (path.length === 0) return;
      const newSchema = JSON.parse(JSON.stringify(this.targetSchema));
      const parentPath = path.slice(0, -1);
      const oldName = path[path.length - 1];
      
      const parent = this.navigateSchema(newSchema, parentPath);
      if (parent && parent.properties && parent.properties[oldName]) {
          const node = parent.properties[oldName];
          const newProps: any = {};
          Object.keys(parent.properties).forEach(k => {
              if (k === oldName) {
                  newProps[newName] = node;
              } else {
                  newProps[k] = parent.properties[k];
              }
          });
          parent.properties = newProps;
          this.updateSchema(newSchema, `Renamed ${oldName} to ${newName}`);
      }
  }

  deleteNode(path: string[]) {
    if (path.length === 0) return;
    const newSchema = JSON.parse(JSON.stringify(this.targetSchema));
    const parentPath = path.slice(0, -1);
    const key = path[path.length - 1];
    
    const parent = this.navigateSchema(newSchema, parentPath);
    if (parent) {
      if (Array.isArray(parent)) {
         parent.splice(parseInt(key), 1);
      } else if (parent.properties && parent.properties[key]) {
         delete parent.properties[key];
      } else if (parent[key]) {
         delete parent[key];
      }
      this.updateSchema(newSchema, `Deleted node at ${path.join('/')}`);
    }
  }

  // Copy/Cut/Paste Operations
  copyNode(path: string[], isCut: boolean) {
     const node = this.navigateSchema(this.targetSchema, path);
     if (node) {
       this.clipboard = {
         mode: isCut ? 'cut' : 'copy',
         path: path,
         data: JSON.parse(JSON.stringify(node))
       };
       logger.log('INFO', isCut ? 'Node cut to clipboard' : 'Node copied to clipboard', null);
     }
  }

  pasteNode(targetPath: string[]) {
    if (!this.clipboard) return;

    const newSchema = JSON.parse(JSON.stringify(this.targetSchema));
    const target = this.navigateSchema(newSchema, targetPath);

    if (target && target.properties) {
       const key = this.clipboard.path[this.clipboard.path.length - 1] + (this.clipboard.mode === 'copy' ? '_copy' : '');
       target.properties[key] = this.clipboard.data;
    } else {
       logger.log('ERROR', 'Cannot paste into this node type (Target must be object properties)', null);
       return;
    }

    if (this.clipboard.mode === 'cut') {
        this.deleteNodeFromSchema(newSchema, this.clipboard.path);
        this.clipboard = null;
    }

    this.updateSchema(newSchema, 'Pasted node');
  }
  
  moveNode(sourcePath: string[], targetPath: string[]) {
      if (sourcePath.length === 0) return;

      const isAncestor = sourcePath.every((p, i) => targetPath[i] === p) && targetPath.length >= sourcePath.length;
      if (isAncestor) return;

      const newSchema = JSON.parse(JSON.stringify(this.targetSchema));
      const sourceNode = this.navigateSchema(newSchema, sourcePath);
      
      if (!sourceNode) return;

      this.deleteNodeFromSchema(newSchema, sourcePath);

      const key = sourcePath[sourcePath.length - 1];
      const target = this.navigateSchema(newSchema, targetPath);
      
      if (target && target.properties) {
          target.properties[key] = sourceNode;
          this.updateSchema(newSchema, `Moved ${key}`);
      } else {
          logger.log('ERROR', 'Invalid drop target (must be object properties)', null);
      }
  }

  setCachedImprovements(improvements: SchemaImprovement[]) {
      this.improvementCache.set(this.schemaName, improvements);
  }

  getCachedImprovements(): SchemaImprovement[] | undefined {
      return this.improvementCache.get(this.schemaName);
  }

  clearCachedImprovements() {
      this.improvementCache.delete(this.schemaName);
  }

  clear() {
    this.files = [];
    this.selectedFileId = null;
    this.targetSchema = JSON.parse(JSON.stringify(DEFAULT_SCHEMA));
    this.schemaName = "DataSchema";
    this.history = [];
    this.clipboard = null;
    this.selectedSchemaPath = [];
    this.improvementCache.clear();
    
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) { console.error(e); }

    logger.log('INFO', 'Workspace reset to defaults', null);
    this.notify();
  }

  resetSchema() {
    const emptySchema = JSON.parse(JSON.stringify(DEFAULT_SCHEMA));
    this.schemaName = "NewSchema";
    this.selectedSchemaPath = [];
    this.updateSchema(emptySchema, "Reset to new empty schema");
    logger.log('INFO', 'Schema reset to new empty state', null);
  }

  // Persistence Logic
  private saveState() {
      try {
          const state = {
              files: this.files,
              targetSchema: this.targetSchema,
              schemaName: this.schemaName,
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
          logger.log('ERROR', 'Failed to save workspace to localStorage (Quota likely exceeded)', null);
      }
  }

  private loadState() {
      try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
              const state = JSON.parse(raw);
              if (state.targetSchema) this.targetSchema = state.targetSchema;
              if (state.schemaName) this.schemaName = state.schemaName;
              if (state.files && Array.isArray(state.files)) this.files = state.files;
              logger.log('INFO', 'Workspace restored from LocalStorage', null);
          }
      } catch (e) {
          logger.log('ERROR', 'Failed to load workspace from localStorage', e);
      }
  }

  private navigateSchema(schema: any, path: string[]) {
    let current = schema;
    for (const p of path) {
      if (current && typeof current === 'object' && p in current) {
         current = current[p];
      } else {
        return null;
      }
    }
    return current;
  }

  private deleteNodeFromSchema(schema: any, path: string[]) {
      if (path.length === 0) return;
      const parentPath = path.slice(0, -1);
      const key = path[path.length - 1];
      const parent = this.navigateSchema(schema, parentPath);
      if (parent) {
          if (Array.isArray(parent)) parent.splice(parseInt(key), 1);
          else if (parent.properties) delete parent.properties[key];
          else delete parent[key];
      }
  }

  getHistory() { return this.history; }

  restoreVersion(versionId: string) {
    const version = this.history.find(v => v.id === versionId);
    if (version) {
      this.updateSchema(version.schema, `Restored from ${new Date(version.timestamp).toLocaleTimeString()}`);
    }
  }

  setMapping(fileId: string, mappedContent: any) {
    // Search recursive
    const findAndSet = (list: JsonFile[]) => {
        for(const f of list) {
            if (f.id === fileId) {
                f.mappedContent = mappedContent;
                return true;
            }
            if (f.children && findAndSet(f.children)) return true;
        }
        return false;
    }
    
    if (findAndSet(this.files)) {
      this.saveState();
      this.notify();
    }
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }
}

export const jsonBuilderService = new JsonBuilderService();
