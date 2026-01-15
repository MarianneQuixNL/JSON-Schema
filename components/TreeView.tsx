import React, { useState } from 'react';
import { PlusSquare, MinusSquare, Folder, File, GripVertical } from 'lucide-react';
import { TreeItem } from '../types';

interface TreeViewProps {
  data: TreeItem[];
  onSelect: (item: TreeItem) => void;
  onContextMenu?: (e: React.MouseEvent, item: TreeItem) => void;
  onDrop?: (sourceId: string, targetId: string, type: string, data?: any) => void;
  selectedId?: string;
}

const TreeNode: React.FC<{ 
  item: TreeItem; 
  onSelect: (i: TreeItem) => void; 
  onContextMenu?: (e: React.MouseEvent, i: TreeItem) => void;
  onDrop?: (s: string, t: string, type: string, data?: any) => void;
  selectedId?: string; 
  depth: number 
}> = ({ item, onSelect, onContextMenu, onDrop, selectedId, depth }) => {
  // Only expand the root level by default
  const [isExpanded, setIsExpanded] = useState(depth === 0);
  const isSelected = item.id === selectedId;

  const handleContextMenu = (e: React.MouseEvent) => {
    if (onContextMenu) {
      e.preventDefault();
      onContextMenu(e, item);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/x-katje-tree-id', item.id);
    
    // Safely try to stringify data
    if (item.data) {
        try {
            e.dataTransfer.setData('application/x-katje-source-data', JSON.stringify(item.data));
        } catch (err) {
            console.warn("Failed to attach data to drag event", err);
        }
    }
    
    e.stopPropagation();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Allow drop
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!onDrop) return;

    // Check for source data drop (from Left Sidebar)
    const sourceDataString = e.dataTransfer.getData('application/x-katje-source-data');
    if (sourceDataString) {
        try {
            const data = JSON.parse(sourceDataString);
            onDrop('EXTERNAL_SOURCE', item.id, 'SOURCE_DATA', data);
            return;
        } catch (e) {
            // ignore invalid json
        }
    }

    // Check for internal tree move
    const sourceId = e.dataTransfer.getData('application/x-katje-tree-id');
    if (sourceId && sourceId !== item.id) {
      onDrop(sourceId, item.id, 'INTERNAL_MOVE');
    }
  };

  const toggleExpand = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsExpanded(!isExpanded);
  };

  const handleSelect = (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(item);
  };

  return (
    <div>
      <div 
        className={`flex items-center gap-2 py-1 px-2 transition-colors ${isSelected ? 'bg-purple-900/50 text-white' : 'text-gray-300 hover:bg-purple-900/20'}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleSelect}
        onContextMenu={handleContextMenu}
        draggable={!!onDrop}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {onDrop && <GripVertical size={12} className="text-gray-600 cursor-grab shrink-0" />}
        
        {/* Expander Icon - Only works on click, distinct from row selection */}
        <div onClick={toggleExpand} className="cursor-pointer shrink-0 text-gray-400 hover:text-white">
            {item.children && item.children.length > 0 ? (
            isExpanded ? <MinusSquare size={14} /> : <PlusSquare size={14} />
            ) : <span className="w-[14px] inline-block" />}
        </div>
        
        {/* Type Icon */}
        {item.children ? <Folder size={16} className="text-purple-400 shrink-0" /> : <File size={16} className="text-slate-400 shrink-0" />}
        
        <span className="text-sm truncate select-none">{item.label}</span>
      </div>
      
      {isExpanded && item.children && (
        <div>
          {item.children.map(child => (
            <TreeNode 
              key={child.id} 
              item={child} 
              onSelect={onSelect} 
              onContextMenu={onContextMenu}
              onDrop={onDrop}
              selectedId={selectedId} 
              depth={depth + 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const TreeView: React.FC<TreeViewProps> = ({ data, onSelect, onContextMenu, onDrop, selectedId }) => {
  return (
    <div className="h-full w-full overflow-auto py-2">
      {data.map(item => (
        <TreeNode 
          key={item.id} 
          item={item} 
          onSelect={onSelect} 
          onContextMenu={onContextMenu}
          onDrop={onDrop}
          selectedId={selectedId} 
          depth={0} 
        />
      ))}
    </div>
  );
};