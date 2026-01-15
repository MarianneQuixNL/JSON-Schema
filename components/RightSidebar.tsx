import React, { useEffect, useState } from 'react';
import { FileJson, Eye, Folder, ChevronRight, ChevronDown } from 'lucide-react';
import { jsonBuilderService } from '../services/jsonBuilder.service';
import { JsonFile } from '../types';

export const RightSidebar: React.FC = () => {
  const [files, setFiles] = useState<JsonFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    const update = () => {
        setFiles([...jsonBuilderService.getFiles()]);
        const selected = jsonBuilderService.getSelectedFile();
        setSelectedId(selected ? selected.id : null);
    };
    update(); // Fetch initial state immediately
    return jsonBuilderService.subscribe(update);
  }, []);

  const handleDragOverContainer = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.types.includes('Files')) {
        setIsDragOver(true);
      }
  };

  const handleDragLeaveContainer = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      setIsDragOver(false);
  };

  const handleDropContainer = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          jsonBuilderService.addFiles(e.dataTransfer.files);
      }
  };

  // Internal Drag Sorting/Grouping
  const handleItemDragStart = (e: React.DragEvent, id: string) => {
      e.dataTransfer.setData('application/x-katje-file-id', id);
      e.stopPropagation();
  };

  const handleItemDrop = (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const sourceId = e.dataTransfer.getData('application/x-katje-file-id');
      if (sourceId && sourceId !== targetId) {
          jsonBuilderService.groupFiles(targetId, sourceId);
          // Auto expand the target group if it becomes one (note: ID might change if new group created, see service)
          const newSet = new Set(expandedGroups);
          newSet.add(targetId);
          setExpandedGroups(newSet);
      }
  };

  const handleItemDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Add visual cue logic here if needed (e.g. highlight border)
  };

  const toggleGroup = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newSet = new Set(expandedGroups);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setExpandedGroups(newSet);
  };

  const FileItem: React.FC<{ file: JsonFile, depth?: number }> = ({ file, depth = 0 }) => {
      // Logic update: If children is defined, it is a group (even if empty)
      const isGroup = file.children !== undefined;
      const isExpanded = expandedGroups.has(file.id);
      const isSelected = selectedId === file.id;

      return (
          <div className="mb-1">
              <div 
                  className={`
                    p-2 rounded border cursor-pointer transition-all flex items-center justify-between group relative
                    ${isSelected ? 'bg-purple-900/40 border-purple-500' : 'bg-dark-surface border-gray-700 hover:border-gray-500'}
                  `}
                  style={{ marginLeft: `${depth * 16}px` }}
                  onClick={() => jsonBuilderService.selectFile(file.id)}
                  draggable
                  onDragStart={(e) => handleItemDragStart(e, file.id)}
                  onDragOver={handleItemDragOver}
                  onDrop={(e) => handleItemDrop(e, file.id)}
              >
                  <div className="flex items-center gap-2 overflow-hidden">
                      {isGroup ? (
                          <div onClick={(e) => toggleGroup(file.id, e)} className="hover:text-white text-gray-400">
                             {isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                          </div>
                      ) : <span className="w-[14px]"/>}
                      
                      {isGroup ? <Folder size={16} className="text-blue-400 shrink-0"/> : <FileJson size={16} className="text-yellow-500 shrink-0" />}
                      <span className="text-sm truncate text-gray-200">{file.name}</span>
                  </div>
                  {isSelected && <Eye size={14} className="text-purple-400" />}
              </div>
              
              {/* Render Children if Group */}
              {isGroup && isExpanded && file.children && (
                  <div className="mt-1">
                      {file.children.map(child => (
                          <FileItem key={child.id} file={child} depth={depth + 1} />
                      ))}
                      {file.children.length === 0 && (
                          <div className="text-xs text-gray-600 italic ml-6 py-1">Empty Group</div>
                      )}
                  </div>
              )}
          </div>
      );
  };

  return (
    <div 
        className={`w-[20vw] bg-dark-bg border-l border-purple-900 flex flex-col h-full overflow-hidden relative ${isDragOver ? 'bg-purple-900/20' : ''}`}
        onDragOver={handleDragOverContainer}
        onDragLeave={handleDragLeaveContainer}
        onDrop={handleDropContainer}
    >
      <div className="p-2 border-b border-purple-900 bg-purple-900/10">
        <h3 className="font-bold text-lavender-100 text-sm">Dropped Files</h3>
      </div>
      <div className="flex-1 overflow-auto p-2 space-y-1">
        {files.length === 0 && (
            <div className="text-gray-500 text-sm italic text-center mt-4">Drop JSON files here</div>
        )}
        {files.map(file => (
            <FileItem key={file.id} file={file} />
        ))}
      </div>
      
      {/* Drop overlay hint */}
      {isDragOver && (
         <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-purple-900/10 backdrop-blur-[1px]">
             <div className="bg-dark-surface p-2 rounded border border-purple-500 text-purple-200 text-xs font-bold">
                 Add Files
             </div>
         </div>
      )}
    </div>
  );
};