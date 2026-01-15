

import React, { useEffect, useState } from 'react';
import { TreeView } from './TreeView';
import { jsonBuilderService } from '../services/jsonBuilder.service';
import { TreeItem, JsonFile } from '../types';
import { PlusCircle, Folder, ChevronDown } from 'lucide-react';

export const LeftSidebar: React.FC = () => {
  const [data, setData] = useState<TreeItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<JsonFile | undefined>(undefined);
  
  // For groups, we need to track which sub-file is currently visible
  const [viewedSubFile, setViewedSubFile] = useState<JsonFile | null>(null);
  
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: TreeItem | null, alignBottom: boolean } | null>(null);

  useEffect(() => {
    const update = () => {
      const file = jsonBuilderService.getSelectedFile();
      setSelectedFile(file);
      
      if (file) {
          // If it's a group, default to first child if not already viewing one from this group
          if (file.children && file.children.length > 0) {
              if (!viewedSubFile || !file.children.find(c => c.id === viewedSubFile.id)) {
                  setViewedSubFile(file.children[0]);
              }
          } else {
              setViewedSubFile(null); // It's a single file
              setData(convertJsonToTree(file.content, 'root'));
          }
      } else {
        setData([]);
        setViewedSubFile(null);
      }
    };
    // Need to listen AND call initially
    update();
    return jsonBuilderService.subscribe(update);
  }, []);

  // Effect to update Tree when viewedSubFile changes
  useEffect(() => {
      if (viewedSubFile) {
          setData(convertJsonToTree(viewedSubFile.content, 'root'));
      } else if (selectedFile && !selectedFile.children) {
          setData(convertJsonToTree(selectedFile.content, 'root'));
      }
  }, [viewedSubFile, selectedFile]);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const convertJsonToTree = (obj: any, idPrefix: string): TreeItem[] => {
    if (typeof obj !== 'object' || obj === null) return [];
    
    return Object.keys(obj).map(key => {
      const value = obj[key];
      const id = `${idPrefix}-${key}`;
      const isObject = typeof value === 'object' && value !== null;
      
      return {
        id,
        label: isObject ? key : `${key}: ${JSON.stringify(value).substring(0, 20)}`,
        data: value, // Store raw value for extraction and drag-drop
        children: isObject ? convertJsonToTree(value, id) : undefined
      };
    });
  };

  const handleContextMenu = (e: React.MouseEvent, item: TreeItem) => {
    e.preventDefault();
    const alignBottom = e.clientY > window.innerHeight / 2;
    setContextMenu({ x: e.clientX, y: e.clientY, item, alignBottom });
  };

  const handleAddToScheme = () => {
    if (contextMenu?.item) {
      const segments = contextMenu.item.id.split('-');
      const key = segments[segments.length - 1];
      const fragment = contextMenu.item.data !== undefined ? contextMenu.item.data : {};
      
      jsonBuilderService.addFragmentToSchema(fragment, key);
    }
    setContextMenu(null);
  };

  return (
    <div className="w-[20vw] bg-dark-bg border-r border-purple-900 flex flex-col h-full overflow-hidden relative">
      <div className="p-2 border-b border-purple-900 bg-purple-900/10">
        <h3 className="font-bold text-lavender-100 text-sm flex items-center gap-2">
            {selectedFile?.children ? <Folder size={14} className="text-yellow-400"/> : null}
            Source Viewer
        </h3>
        
        {/* Dropdown for Groups */}
        {selectedFile?.children && selectedFile.children.length > 0 ? (
            <div className="mt-2 relative">
                <select 
                    className="w-full bg-dark-surface border border-purple-900 rounded p-1 text-xs text-white outline-none appearance-none cursor-pointer hover:border-purple-500"
                    value={viewedSubFile?.id || ''}
                    onChange={(e) => {
                        const sub = selectedFile.children?.find(c => c.id === e.target.value);
                        if(sub) setViewedSubFile(sub);
                    }}
                >
                    {selectedFile.children.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-2 text-gray-400 pointer-events-none"/>
            </div>
        ) : (
            <p className="text-xs text-gray-400 truncate mt-1">
                {selectedFile ? selectedFile.name : 'No file selected'}
            </p>
        )}
      </div>

      <div className="flex-1 overflow-auto w-full">
         {data.length > 0 ? (
             <TreeView 
               data={data} 
               onSelect={() => {}} 
               onContextMenu={handleContextMenu}
               onDrop={(s, t, type, d) => {}} 
             />
         ) : (
             <div className="p-4 text-gray-500 text-sm italic">
                 {selectedFile ? "File is empty or invalid JSON." : "Select a file from the right to view structure."}
             </div>
         )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className={`fixed z-50 bg-dark-surface border border-purple-900 rounded shadow-xl py-1 w-48 ${contextMenu.alignBottom ? 'bottom-full mb-1' : ''}`}
          style={contextMenu.alignBottom ? { left: contextMenu.x, top: 'auto', bottom: window.innerHeight - contextMenu.y } : { top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            onClick={handleAddToScheme}
            className="w-full text-left px-4 py-2 text-sm hover:bg-purple-900/50 text-white flex items-center gap-2"
          >
            <PlusCircle size={14} /> Add to Selected Node
          </button>
        </div>
      )}
    </div>
  );
};
