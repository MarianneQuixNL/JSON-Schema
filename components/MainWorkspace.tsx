

import React, { useState, useEffect, useRef } from 'react';
import { jsonBuilderService } from '../services/jsonBuilder.service';
import { geminiService } from '../services/gemini.service';
import { jobManager } from '../services/jobManager.service';
import { useJobs } from '../hooks/useJobs';
import { Spinner } from './Spinner';
import { Download, Save, Play, History, Upload, Code, ListTree, Edit, Trash, Copy, Scissors, Clipboard, Plus, FileText, FolderPlus, FolderOpen, Link } from 'lucide-react';
import { HistoryDialog } from './HistoryDialog';
import { Dialog } from './Dialog';
import { logger } from '../services/logger.service';
import { SYSTEM_INSTRUCTIONS } from '../constants/prompts';
import { TreeView } from './TreeView';
import { TreeItem } from '../types';

export const MainWorkspace: React.FC = () => {
  const [mode, setMode] = useState<'SCHEMA' | 'PREVIEW'>('SCHEMA');
  const [viewMode, setViewMode] = useState<'TREE' | 'JSON'>('TREE');
  const [schema, setSchema] = useState<any>({});
  const [schemaName, setSchemaName] = useState('DataSchema');
  const [schemaTree, setSchemaTree] = useState<TreeItem[]>([]);
  const [selectedSchemaNodeId, setSelectedSchemaNodeId] = useState<string | null>(null);
  
  // JSON Editor State
  const [localJsonText, setLocalJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: TreeItem, alignBottom: boolean } | null>(null);
  
  const [prompt, setPrompt] = useState('');
  const [includeSource, setIncludeSource] = useState(true);

  const [previewData, setPreviewData] = useState<any>(null);
  const [previewTree, setPreviewTree] = useState<TreeItem[]>([]);
  const [processingFileId, setProcessingFileId] = useState<string | null>(null);
  
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Schema Replace Dialog
  const [schemaReplaceOpen, setSchemaReplaceOpen] = useState(false);
  const [pendingSchemaLoad, setPendingSchemaLoad] = useState<{ content: any, name: string } | null>(null);

  // Dialogs for input
  const [inputDialogOpen, setInputDialogOpen] = useState(false);
  const [inputDialogTitle, setInputDialogTitle] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [inputAction, setInputAction] = useState<(val: string) => void>(() => {});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { running } = useJobs();
  // Ensure we catch Analysis, Prompt-based edits, and Code Gen for the spinner
  const isSchemaJobRunning = running.some(j => 
    j.name.startsWith('Analyze') || 
    j.name.startsWith('Schema') || 
    j.name.startsWith('Generate') ||
    j.name.startsWith('Validate') ||
    j.name.startsWith('Gen Data')
  );

  // Helper to resolve a JSON pointer (e.g. #/definitions/address)
  const resolveRef = (ref: string, root: any): any => {
      if (!ref.startsWith('#/')) return null; // Only handle internal refs for now
      const parts = ref.substring(2).split('/');
      let current = root;
      for (const part of parts) {
          // Decode generic JSON pointer escape sequences if needed (ignoring ~1 ~0 for simplicity as it's rare in this app)
          if (current && typeof current === 'object' && part in current) {
              current = current[part];
          } else {
              return null;
          }
      }
      return current;
  };

  // Data Preview Converter (Standard JSON)
  const convertDataToTree = (obj: any, idPrefix: string): TreeItem[] => {
    if (typeof obj !== 'object' || obj === null) return [];
    return Object.keys(obj).map(key => {
      const value = obj[key];
      const id = `${idPrefix}.${key}`;
      const isObject = typeof value === 'object' && value !== null;
      let label = key;
      
      if (!isObject) {
          label += `: ${JSON.stringify(value).substring(0, 30)}`;
      }

      return {
        id,
        label,
        children: isObject ? convertDataToTree(value, id) : undefined
      };
    });
  };

  // Schema Converter with Ref Resolution
  const convertSchemaToTree = (obj: any, idPath: string, keyName: string, root: any, depth: number = 0): TreeItem => {
      if (depth > 20) {
          return { id: idPath, label: `${keyName} (Max Depth Reached)` };
      }

      // Check for Ref
      if (obj.$ref) {
          const resolved = resolveRef(obj.$ref, root);
          const refName = obj.$ref.split('/').pop();
          
          if (resolved) {
              // Recursively render the resolved schema, but treat it as children of this node
              // We pretend this node IS the resolved schema, effectively inlining it in the UI tree
              // But we mark it as a REF
              const children = getChildrenFromSchemaObject(resolved, idPath, root, depth + 1);
              return {
                  id: idPath,
                  label: `${keyName} (Ref: ${refName})`,
                  children
              };
          } else {
             return { id: idPath, label: `${keyName} (Unresolved Ref: ${obj.$ref})` }; 
          }
      }

      const type = obj.type || 'unknown';
      // Label format: "KeyName (type, description)"
      let label = `${keyName} (${type}`;
      if (obj.description) {
          // Truncate description if too long
          const desc = obj.description.length > 40 ? obj.description.substring(0, 37) + '...' : obj.description;
          label += `, ${desc}`;
      }
      label += ')';
      
      const children = getChildrenFromSchemaObject(obj, idPath, root, depth);

      return {
          id: idPath,
          label,
          children
      };
  };

  const getChildrenFromSchemaObject = (obj: any, idPath: string, root: any, depth: number): TreeItem[] | undefined => {
      let children: TreeItem[] | undefined = undefined;

      // Handle combinators
      const combinators = ['oneOf', 'anyOf', 'allOf'] as const;
      for (const combinator of combinators) {
          if (Array.isArray(obj[combinator])) {
              const comboChildren = obj[combinator].map((subSchema: any, idx: number) => 
                  convertSchemaToTree(subSchema, `${idPath}.${combinator}.${idx}`, `Option ${idx + 1}`, root, depth + 1)
              );
              
              // We append combinator info to children if existing or create new
              const comboNode: TreeItem = {
                  id: `${idPath}.${combinator}`,
                  label: `${combinator} (${comboChildren.length} options)`,
                  children: comboChildren
              };
              
              if (!children) children = [];
              children.push(comboNode);
          }
      }

      // If it has properties, iterate them but DON'T make a 'properties' node.
      if (obj.properties) {
          const props = Object.keys(obj.properties).map(propKey => {
             // Important: The ID Path MUST include 'properties' so operations work
             return convertSchemaToTree(obj.properties[propKey], `${idPath}.properties.${propKey}`, propKey, root, depth + 1);
          });
          children = children ? [...children, ...props] : props;
      } else if (obj.items) {
          // Handle arrays
          const itemNode = convertSchemaToTree(obj.items, `${idPath}.items`, 'items', root, depth + 1);
          children = children ? [...children, itemNode] : [itemNode];
      }
      
      return children;
  }

  const ensureMapping = (file: any) => {
      if (file.mappedContent) return; // Already have it
      if (processingFileId === file.id) return; // Already working on it

      setProcessingFileId(file.id);
      
      jobManager.addJob(
        `Map ${file.name} to Schema`,
        ['Map Source to Target Schema'],
        async (job) => {
             const currentSchema = jsonBuilderService.getSchema();
             const mapped = await geminiService.mapJson(file.content, currentSchema);
             jsonBuilderService.setMapping(file.id, mapped);
             return mapped;
        },
        SYSTEM_INSTRUCTIONS
    );
  };

  useEffect(() => {
    const update = () => {
      const currentSchema = jsonBuilderService.getSchema();
      setSchema(currentSchema);
      setSchemaName(jsonBuilderService.getSchemaName());
      
      // Pass currentSchema as root to allow resolving refs
      const rootNode = convertSchemaToTree(currentSchema, 'root', 'Root', currentSchema);
      setSchemaTree([rootNode]);
      
      const selected = jsonBuilderService.getSelectedFile();
      
      if (mode === 'PREVIEW' && selected) {
        if (selected.mappedContent) {
            setPreviewData(selected.mappedContent);
            setPreviewTree(convertDataToTree(selected.mappedContent, 'preview'));
            setProcessingFileId(null);
        } else {
            setPreviewData(null);
            setPreviewTree([]);
            ensureMapping(selected);
        }
      } else if (mode === 'PREVIEW' && !selected) {
         setPreviewData(null);
         setPreviewTree([]);
      }
    };
    
    // Initial call
    update();
    return jsonBuilderService.subscribe(update);
  }, [mode, processingFileId]); // Dependent on mode to switch behavior

  // Effect to trigger mapping when entering preview mode
  useEffect(() => {
      if (mode === 'PREVIEW') {
          const selected = jsonBuilderService.getSelectedFile();
          if (selected) ensureMapping(selected);
      }
  }, [mode]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const parsePathFromId = (id: string): string[] => {
      if (id === 'root') return [];
      if (id.startsWith('root.')) {
          return id.replace('root.', '').split('.');
      }
      return [];
  };

  const handleSchemaSelect = (item: TreeItem) => {
    setSelectedSchemaNodeId(item.id);
    const path = parsePathFromId(item.id);
    jsonBuilderService.setSelectedSchemaPath(path);
  };

  const handleSchemaContextMenu = (e: React.MouseEvent, item: TreeItem) => {
    e.preventDefault();
    e.stopPropagation();
    
    const alignBottom = e.clientY > window.innerHeight / 2;
    setContextMenu({ x: e.clientX, y: e.clientY, item, alignBottom });
    handleSchemaSelect(item);
  };

  const handleSchemaDrop = (sourceId: string, targetId: string, type: string, data?: any) => {
    const targetPath = parsePathFromId(targetId);

    if (type === 'EXTERNAL_SOURCE' && data) {
        // Dropped from Source Viewer
        const key = `field_${Date.now().toString().slice(-4)}`;
        jsonBuilderService.addFragmentToSchema(data, key, targetPath);
        return;
    }

    // Internal Move
    const sourcePath = parsePathFromId(sourceId);
    jsonBuilderService.moveNode(sourcePath, targetPath);
  };

  const openInputDialog = (title: string, callback: (val: string) => void) => {
      setInputDialogTitle(title);
      setInputValue('');
      setInputAction(() => callback);
      setInputDialogOpen(true);
  };

  const handleContextMenuAction = (action: string) => {
      if (!selectedSchemaNodeId) return;
      const path = parsePathFromId(selectedSchemaNodeId);

      switch(action) {
          case 'delete': jsonBuilderService.deleteNode(path); break;
          case 'copy': jsonBuilderService.copyNode(path, false); break;
          case 'cut': jsonBuilderService.copyNode(path, true); break;
          case 'paste': jsonBuilderService.pasteNode(path); break;
          case 'rename': 
            openInputDialog('Rename Node', (newName) => {
                if(newName) jsonBuilderService.renameNode(path, newName);
            });
            break;
          case 'add_string': 
            openInputDialog('Add String Field', (name) => {
               if(name) jsonBuilderService.addNode('string', name);
            });
            break;
           case 'add_number': 
            openInputDialog('Add Number Field', (name) => {
               if(name) jsonBuilderService.addNode('number', name);
            });
            break;
           case 'add_boolean': 
            openInputDialog('Add Boolean Field', (name) => {
               if(name) jsonBuilderService.addNode('boolean', name);
            });
            break;
           case 'add_object': 
            openInputDialog('Add Object', (name) => {
               if(name) jsonBuilderService.addNode('object', name);
            });
            break;
           case 'add_array': 
            openInputDialog('Add Array', (name) => {
               if(name) jsonBuilderService.addNode('array', name);
            });
            break;
           case 'copy_path':
             // Convert internal "root.properties.foo" ID to a standardized path format like "#/properties/foo"
             // Remove "root." prefix first
             let rawPath = selectedSchemaNodeId.replace('root.', '');
             if (selectedSchemaNodeId === 'root') rawPath = '';
             // Ensure it looks like a path. Replace dots with slashes? 
             // The ID structure uses dots: "properties.address.properties.city"
             // Standard JSON pointer would be: "/properties/address/properties/city"
             const cleanPath = rawPath ? `#/${rawPath.split('.').join('/')}` : '#/';
             navigator.clipboard.writeText(cleanPath);
             break;
      }
      setContextMenu(null);
  };

  const handlePromptSubmit = async () => {
    if (!prompt.trim()) return;

    const lowerPrompt = prompt.toLowerCase();
    
    // CASE 1: Data Generation
    if (lowerPrompt.includes('generate data') || lowerPrompt.includes('generate file') || lowerPrompt.includes('generate source') || lowerPrompt.includes('generate json')) {
         jobManager.addJob(
            `Generate Source File`,
            ['Analyze Schema', 'Generate Synthetic Data', 'Add to Workspace', 'Select File'],
            async (job) => {
                const currentSchema = jsonBuilderService.getSchema();
                const syntheticData = await geminiService.generateSyntheticData(currentSchema, prompt);
                
                // Add as file and get ID
                const fileName = `Generated_Data_${Date.now()}.json`;
                const newFileId = jsonBuilderService.addFile(fileName, syntheticData);
                
                // Automatically select it to show in Left Sidebar (Source Viewer)
                jsonBuilderService.selectFile(newFileId);
                
                return "Data Generated, Added and Selected";
            },
            SYSTEM_INSTRUCTIONS
         );
         setPrompt('');
         return;
    }
    
    // CASE 2: Schema Modification / Generation
    const selected = jsonBuilderService.getSelectedFile();
    const sourceJson = (includeSource && selected) ? selected.content : null;

    // Detect if this is likely a creation request or major build request
    const isNewSchema = lowerPrompt.includes('generate schema') || 
                        lowerPrompt.includes('create schema') || 
                        lowerPrompt.includes('new schema') ||
                        lowerPrompt.includes('make schema') ||
                        lowerPrompt.includes('build schema');

    jobManager.addJob(
        `Schema: ${prompt.substring(0, 20)}...`,
        [prompt],
        async (job) => {
             const currentSchema = jsonBuilderService.getSchema();
             const newSchema = await geminiService.modifySchema(
                currentSchema, 
                prompt, 
                sourceJson,
                SYSTEM_INSTRUCTIONS
            );
            
            // Update workspace schema
            jsonBuilderService.updateSchema(newSchema, `User Prompt: ${prompt.substring(0, 30)}...`);
            
            // If the user requested a NEW schema (or major build), save it to the Right Sidebar
            if (isNewSchema) {
                let filename = `Generated_Schema_${Date.now()}.json`;
                if (newSchema.title) {
                    const safeTitle = newSchema.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                    filename = `${safeTitle}.json`;
                }
                jsonBuilderService.addFile(filename, newSchema);
            }
            
            return "Schema Modified";
        },
        SYSTEM_INSTRUCTIONS
    );
    
    setPrompt('');
  };

  const handlePreview = async () => {
    if (mode === 'PREVIEW') return;

    // If switching from JSON edit mode, validate first
    if (viewMode === 'JSON') {
        try {
            const parsed = JSON.parse(localJsonText);
            jsonBuilderService.updateSchema(parsed, 'Manual Edit (Switch to Preview)');
        } catch (e) {
            setJsonError("Cannot switch to Preview: Invalid JSON in editor.");
            return; 
        }
    }

    const selected = jsonBuilderService.getSelectedFile();
    if (!selected) {
        logger.log('INFO', 'Preview attempted without selection', null);
    }
    setMode('PREVIEW');
  };

  const handleSwitchView = (newView: 'TREE' | 'JSON') => {
      if (newView === viewMode) return;

      if (viewMode === 'JSON') {
          // Validate and parse before switching back to tree
          try {
              const parsed = JSON.parse(localJsonText);
              jsonBuilderService.updateSchema(parsed, 'Manual Edit');
              setJsonError(null);
              setViewMode('TREE');
          } catch (e) {
              setJsonError('Invalid JSON. Please fix errors before switching back to Tree view.');
          }
      } else {
          // Switching from Tree to JSON
          setLocalJsonText(JSON.stringify(schema, null, 2));
          setJsonError(null);
          setViewMode('JSON');
      }
  };

  const handleSavePreview = () => {
    const selected = jsonBuilderService.getSelectedFile();
    if (!selected || !previewData) return;
    
    const blob = new Blob([JSON.stringify(previewData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mapped_${selected.name}`;
    a.click();
  };
  
  const handleDownloadSchema = () => {
      const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${schemaName}.json`;
      a.click();
  };

  const handleLoadSchemaClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
        if (files.length === 1) {
            // Single file check for schema replacement
            const file = files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const content = JSON.parse(ev.target?.result as string);
                    if (jsonBuilderService.isJsonSchema(content)) {
                        setPendingSchemaLoad({ content, name: file.name });
                        setSchemaReplaceOpen(true);
                    } else {
                        jsonBuilderService.addFiles(files);
                    }
                } catch (err) {
                    logger.log('ERROR', 'File Load Error', err);
                }
            };
            reader.readAsText(file);
        } else {
            // Multiple files -> Just add/group them
            jsonBuilderService.addFiles(files);
        }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmReplace = () => {
      if (pendingSchemaLoad) {
          jsonBuilderService.loadSchema(pendingSchemaLoad.content, pendingSchemaLoad.name);
          setPendingSchemaLoad(null);
      }
      setSchemaReplaceOpen(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.types.includes('Files')) {
         setIsDragOver(true);
      }
  };

  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      
      const files = e.dataTransfer.files;

      if (files && files.length > 0) {
          if (files.length === 1) {
              const file = files[0];
              const reader = new FileReader();
              reader.onload = (ev) => {
                  try {
                      const content = JSON.parse(ev.target?.result as string);
                      if (jsonBuilderService.isJsonSchema(content)) {
                           setPendingSchemaLoad({ content, name: file.name });
                           setSchemaReplaceOpen(true);
                      } else {
                           jsonBuilderService.addFiles(files);
                      }
                  } catch (err) {
                      jsonBuilderService.addFiles(files);
                  }
              };
              reader.readAsText(file);
          } else {
              // Multiple files -> batch load as group
              jsonBuilderService.addFiles(files);
          }
      }
  };

  const handleIncludeSourceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const checked = e.target.checked;
      setIncludeSource(checked);
      if (!checked) {
          jsonBuilderService.selectFile(''); // Deselect
      }
  };

  return (
    <div 
        className="flex-1 flex flex-col h-full bg-dark-bg relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
    >
      {/* Allow multiple files selection */}
      <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".json,application/json" multiple />

      {/* File Drop Overlay */}
      {isDragOver && (
          <div className="absolute inset-0 z-50 bg-purple-900/80 backdrop-blur-sm flex flex-col items-center justify-center border-4 border-dashed border-lavender-100 m-4 rounded-xl pointer-events-none">
              <Upload size={64} className="text-white mb-4 animate-bounce" />
              <h2 className="text-2xl font-bold text-white mb-8">Drop JSON files here</h2>
          </div>
      )}

      {/* Schema Modification Spinner Overlay */}
      {isSchemaJobRunning && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-50 backdrop-blur-sm">
            <Spinner size={100} color="blue" />
            <p className="mt-4 text-blue-200 font-bold animate-pulse">Running Job...</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="h-12 border-b border-purple-900 bg-dark-surface flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
           {/* Schema Name Input */}
           <div className="flex items-center gap-2">
             <span className="text-gray-400 text-sm">Schema:</span>
             <input 
                value={schemaName}
                onChange={(e) => jsonBuilderService.setSchemaName(e.target.value)}
                className="bg-dark-bg border border-purple-900 rounded px-2 py-1 text-sm text-white w-48 focus:border-purple-500 outline-none"
             />
             <button onClick={handleDownloadSchema} className="p-1 hover:text-green-400 text-gray-400" title="Download Schema">
                 <Download size={16} />
             </button>
             <button onClick={handleLoadSchemaClick} className="p-1 hover:text-blue-400 text-gray-400" title="Load Schema">
                 <FolderOpen size={16} />
             </button>
           </div>
           
           <div className="h-6 w-px bg-purple-900 mx-2" />

           <button 
             onClick={() => { setMode('SCHEMA'); }}
             className={`px-4 py-1 rounded text-sm font-bold ${mode === 'SCHEMA' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-white/10'}`}
           >
             Schema Builder
           </button>
           <button 
             onClick={handlePreview}
             className={`px-4 py-1 rounded text-sm font-bold flex items-center gap-2 ${mode === 'PREVIEW' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-white/10'}`}
           >
             <Play size={14} /> Preview
           </button>
        </div>

        <div className="flex items-center gap-2">
            {mode === 'SCHEMA' && (
              <>
                <div className="flex bg-slate-800 rounded mr-2">
                  <button 
                    onClick={() => handleSwitchView('TREE')} 
                    className={`p-1 px-2 rounded-l ${viewMode === 'TREE' ? 'bg-purple-700 text-white' : 'text-gray-400'}`} 
                    title="Tree View"
                  >
                    <ListTree size={16} />
                  </button>
                  <button 
                    onClick={() => handleSwitchView('JSON')} 
                    className={`p-1 px-2 rounded-r ${viewMode === 'JSON' ? 'bg-purple-700 text-white' : 'text-gray-400'}`}
                    title="JSON Code View"
                  >
                    <Code size={16} />
                  </button>
                </div>
                <div className="h-6 w-px bg-purple-900 mx-1" />
              </>
            )}

            <button onClick={() => setHistoryOpen(true)} className="p-2 text-gray-400 hover:text-white" title="History">
                <History size={18} />
            </button>
            {mode === 'PREVIEW' && (
                <button onClick={handleSavePreview} className="flex items-center gap-2 px-3 py-1 bg-green-700 hover:bg-green-600 text-white rounded text-sm">
                    <Save size={14} /> Save JSON
                </button>
            )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-4 relative">
         {mode === 'SCHEMA' ? (
             <div className="h-full flex flex-col">
                 <div className="text-gray-400 text-xs mb-2 flex justify-between">
                   <span>Target Schema (JSON Schema Draft 2020-12)</span>
                   {selectedSchemaNodeId && <span className="text-purple-400">Path: {selectedSchemaNodeId.replace('root.', '').replace('root', '/').replace(/\.properties\./g, '/').replace(/\.items/g, '[]')}</span>}
                 </div>
                 
                 {viewMode === 'TREE' ? (
                   <div className="flex-1 bg-dark-surface border border-purple-900 rounded overflow-auto">
                     <TreeView 
                        data={schemaTree} 
                        onSelect={handleSchemaSelect}
                        onContextMenu={handleSchemaContextMenu}
                        onDrop={handleSchemaDrop}
                        selectedId={selectedSchemaNodeId || undefined} 
                     />
                   </div>
                 ) : (
                   <div className="flex-1 bg-dark-surface border border-purple-900 rounded overflow-hidden flex flex-col relative">
                      {jsonError && (
                          <div className="bg-red-900/50 text-red-200 text-xs p-2 absolute top-0 left-0 right-0 z-20 border-b border-red-500">
                              {jsonError}
                          </div>
                      )}
                      <textarea
                        className="flex-1 w-full h-full bg-dark-surface p-4 font-mono text-sm text-white resize-none outline-none border-none"
                        value={localJsonText}
                        onChange={(e) => {
                            setLocalJsonText(e.target.value);
                            setJsonError(null);
                        }}
                        spellCheck={false}
                      />
                   </div>
                 )}
             </div>
         ) : (
             <div className="h-full flex flex-col">
                 <div className="text-gray-400 text-xs mb-2">Mapped Preview (Tree View)</div>
                 <div className="flex-1 bg-dark-surface border border-purple-900 rounded overflow-auto relative">
                    {processingFileId ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-10">
                            <Spinner size={50} color="violet" />
                            <p className="mt-4 text-lavender-100 font-bold animate-pulse">Generating Mapping...</p>
                        </div>
                    ) : null}
                    
                    {previewData ? (
                        <TreeView 
                           data={previewTree} 
                           onSelect={() => {}} 
                        />
                    ) : (
                        !processingFileId && (
                            <div className="p-4 text-gray-500 italic">
                                {jsonBuilderService.getSelectedFile() 
                                   ? "Processing..." 
                                   : "Select a file to map it to the current schema."}
                            </div>
                        )
                    )}
                 </div>
             </div>
         )}
      </div>

      {/* Bottom Prompt Area */}
      <div className="h-32 border-t border-purple-900 bg-dark-surface p-4 flex gap-4">
         <textarea 
            className="flex-1 bg-dark-bg border border-purple-900 rounded p-2 text-white resize-none focus:border-purple-500 outline-none"
            placeholder="Describe changes or ask to generate data (e.g. 'Generate synthetic data for this schema')"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handlePromptSubmit();
                }
            }}
         />
         <div className="flex flex-col gap-2 w-24">
             <button 
                onClick={handlePromptSubmit}
                className="w-full h-10 bg-purple-700 hover:bg-purple-600 text-white rounded font-bold flex items-center justify-center"
             >
                Apply
             </button>
             <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
                 <input 
                    type="checkbox" 
                    checked={includeSource} 
                    onChange={handleIncludeSourceChange}
                    className="rounded border-purple-900 bg-dark-bg text-purple-600 focus:ring-purple-500"
                 />
                 Include source
             </label>
         </div>
      </div>

      {/* Dialogs */}
      <HistoryDialog isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
      
      <Dialog 
        isOpen={inputDialogOpen} 
        title={inputDialogTitle} 
        onClose={() => setInputDialogOpen(false)}
        onOk={() => { inputAction(inputValue); setInputDialogOpen(false); }}
      >
          <div className="p-4">
              <input 
                 autoFocus
                 className="w-full bg-dark-bg border border-purple-900 p-2 rounded text-white"
                 value={inputValue}
                 onChange={(e) => setInputValue(e.target.value)}
                 onKeyDown={(e) => { if(e.key === 'Enter') { inputAction(inputValue); setInputDialogOpen(false); } }}
              />
          </div>
      </Dialog>
      
      <Dialog
        isOpen={schemaReplaceOpen}
        title="Replace Schema?"
        onClose={() => setSchemaReplaceOpen(false)}
        onOk={handleConfirmReplace}
        okText="Replace"
      >
          <div className="p-6">
              <p className="text-lg mb-4">You are loading <strong>{pendingSchemaLoad?.name}</strong>.</p>
              <p className="text-gray-300">This file appears to be a JSON Schema. Do you want to replace your current workspace schema with this file?</p>
              <p className="text-xs text-gray-500 mt-4">If you cancel, it will be added as a data source file instead.</p>
          </div>
      </Dialog>

      {/* Context Menu */}
      {contextMenu && (
          <div 
            className={`fixed z-50 bg-dark-surface border border-purple-900 rounded shadow-xl py-1 w-56 ${contextMenu.alignBottom ? 'bottom-full mb-1' : ''}`}
            style={contextMenu.alignBottom ? { left: contextMenu.x, top: 'auto', bottom: window.innerHeight - contextMenu.y } : { top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
             <button onClick={() => handleContextMenuAction('copy_path')} className="w-full text-left px-4 py-2 text-sm hover:bg-purple-900/50 text-white flex items-center gap-2"><Link size={14}/> Copy Path</button>
             <div className="border-t border-purple-900 my-1"/>
             <button onClick={() => handleContextMenuAction('rename')} className="w-full text-left px-4 py-2 text-sm hover:bg-purple-900/50 text-white flex items-center gap-2"><Edit size={14}/> Rename</button>
             <div className="border-t border-purple-900 my-1"/>
             <div className="px-4 py-1 text-xs text-gray-500 font-bold uppercase">Add Node</div>
             <button onClick={() => handleContextMenuAction('add_string')} className="w-full text-left px-4 py-2 text-sm hover:bg-purple-900/50 text-white flex items-center gap-2 ml-2"><FileText size={14}/> String</button>
             <button onClick={() => handleContextMenuAction('add_number')} className="w-full text-left px-4 py-2 text-sm hover:bg-purple-900/50 text-white flex items-center gap-2 ml-2"><HashIcon size={14}/> Number</button>
             <button onClick={() => handleContextMenuAction('add_boolean')} className="w-full text-left px-4 py-2 text-sm hover:bg-purple-900/50 text-white flex items-center gap-2 ml-2"><CheckSquare size={14}/> Boolean</button>
             <button onClick={() => handleContextMenuAction('add_object')} className="w-full text-left px-4 py-2 text-sm hover:bg-purple-900/50 text-white flex items-center gap-2 ml-2"><FolderPlus size={14}/> Object</button>
             <button onClick={() => handleContextMenuAction('add_array')} className="w-full text-left px-4 py-2 text-sm hover:bg-purple-900/50 text-white flex items-center gap-2 ml-2"><ListTree size={14}/> Array</button>
             <div className="border-t border-purple-900 my-1"/>
             <button onClick={() => handleContextMenuAction('copy')} className="w-full text-left px-4 py-2 text-sm hover:bg-purple-900/50 text-white flex items-center gap-2"><Copy size={14}/> Copy</button>
             <button onClick={() => handleContextMenuAction('cut')} className="w-full text-left px-4 py-2 text-sm hover:bg-purple-900/50 text-white flex items-center gap-2"><Scissors size={14}/> Cut</button>
             <button onClick={() => handleContextMenuAction('paste')} className="w-full text-left px-4 py-2 text-sm hover:bg-purple-900/50 text-white flex items-center gap-2"><Clipboard size={14}/> Paste</button>
             <div className="border-t border-purple-900 my-1"/>
             <button onClick={() => handleContextMenuAction('delete')} className="w-full text-left px-4 py-2 text-sm hover:bg-red-900/50 text-red-300 flex items-center gap-2"><Trash size={14}/> Delete</button>
          </div>
      )}
    </div>
  );
};

// Icon helpers
const HashIcon = ({size}: {size: number}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="9" x2="20" y2="9"></line><line x1="4" y1="15" x2="20" y2="15"></line><line x1="10" y1="3" x2="8" y2="21"></line><line x1="16" y1="3" x2="14" y2="21"></line></svg>;
const CheckSquare = ({size}: {size: number}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>;
