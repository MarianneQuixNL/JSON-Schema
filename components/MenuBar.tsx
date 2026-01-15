

import React, { useState } from 'react';
import { Settings, HelpCircle, File, Terminal, Key, Database, Play, Code, FileJson, CheckCircle, RefreshCw, FilePlus, Printer, FileText, FileCode, Database as DbIcon, Image, Sparkles, Layers } from 'lucide-react';

interface MenuBarProps {
  onOpenSettings: () => void;
  onOpenApiKey: () => void;
  onOpenDoc: (docId: string) => void;
  onClear: () => void;
  onNewSchema: () => void;
  onImportImage: () => void;
  // Schema Actions
  onValidate: () => void;
  onAnalyze: () => void;
  onImproveSchema: () => void;
  onGenerateCSharp: () => void;
  onGenerateTypeScript: () => void;
  onGenerateSQL: () => void;
  onGenerateData: () => void;
  onPrintSchema: () => void;
  onSaveMarkdown: () => void;
  onRestructureAll: () => void;
}

export const MenuBar: React.FC<MenuBarProps> = ({ 
  onOpenSettings, 
  onOpenApiKey, 
  onOpenDoc, 
  onClear,
  onNewSchema,
  onImportImage,
  onValidate,
  onAnalyze,
  onImproveSchema,
  onGenerateCSharp,
  onGenerateTypeScript,
  onGenerateSQL,
  onGenerateData,
  onPrintSchema,
  onSaveMarkdown,
  onRestructureAll
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const MenuItem = ({ label, icon: Icon, children, id, alignRight = false }: any) => (
    <div className="relative">
      <button 
        className={`flex items-center gap-2 px-4 py-2 hover:bg-white/10 transition-colors text-sm font-medium ${activeMenu === id ? 'bg-white/10' : ''}`}
        onClick={() => setActiveMenu(activeMenu === id ? null : id)}
      >
        {Icon && <Icon size={16} />}
        {label}
      </button>
      {activeMenu === id && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
          <div className={`absolute top-full ${alignRight ? 'right-0' : 'left-0'} bg-dark-surface border border-purple-900 min-w-[220px] shadow-xl z-20 py-1 rounded-b`}>
             {children}
          </div>
        </>
      )}
    </div>
  );

  const MenuOption = ({ onClick, label, icon: Icon, colorClass = "text-white" }: any) => (
      <button 
        onClick={() => { onClick(); setActiveMenu(null); }} 
        className={`w-full text-left px-4 py-2 text-sm hover:bg-purple-900/30 flex items-center gap-3 ${colorClass}`}
      >
        {Icon && <Icon size={14} />}
        {label}
      </button>
  );

  const MenuSeparator = () => <div className="h-px bg-purple-900 my-1" />;

  return (
    <div className="h-10 bg-dark-bg border-b border-purple-900 flex items-center px-2 select-none relative z-40">
      <MenuItem label="File" icon={File} id="file">
         <MenuOption onClick={onNewSchema} label="New Schema" icon={FilePlus} />
         <MenuOption onClick={onImportImage} label="Import from Image..." icon={Image} colorClass="text-purple-300" />
         <MenuSeparator />
         <MenuOption onClick={onClear} label="Clear Workspace" colorClass="text-red-300" />
      </MenuItem>
      
      <MenuItem label="Schema" icon={Database} id="schema">
         <MenuOption onClick={onAnalyze} label="Analyze Source File(s)" icon={RefreshCw} colorClass="text-blue-300" />
         <MenuOption onClick={onValidate} label="Validate Schema" icon={CheckCircle} colorClass="text-green-300" />
         <MenuOption onClick={onImproveSchema} label="Improve Schema" icon={Sparkles} colorClass="text-yellow-300" />
         <MenuSeparator />
         <MenuOption onClick={onRestructureAll} label="Restructure All Files" icon={Layers} colorClass="text-orange-300" />
         <MenuSeparator />
         <MenuOption onClick={onPrintSchema} label="Print Schema (PDF)" icon={Printer} />
         <MenuOption onClick={onSaveMarkdown} label="Save as Markdown" icon={FileText} />
         <MenuSeparator />
         <MenuOption onClick={onGenerateCSharp} label="Generate C# Code" icon={Code} colorClass="text-blue-300" />
         <MenuOption onClick={onGenerateTypeScript} label="Generate TypeScript" icon={FileCode} colorClass="text-blue-300" />
         <MenuOption onClick={onGenerateSQL} label="Generate SQL DDL" icon={DbIcon} colorClass="text-blue-300" />
         <MenuSeparator />
         <MenuOption onClick={onGenerateData} label="Generate Synthetic Data" icon={FileJson} colorClass="text-yellow-300" />
      </MenuItem>

      <div className="flex-1" />

      <MenuItem label="Settings" icon={Settings} id="settings">
         <MenuOption onClick={onOpenSettings} label="Console" icon={Terminal} />
         <MenuOption onClick={onOpenApiKey} label="API Key" icon={Key} />
      </MenuItem>

      <MenuItem label="" icon={HelpCircle} id="docs" alignRight>
         <MenuOption onClick={() => onOpenDoc('SYSTEM')} label="System Instructions" />
         <MenuOption onClick={() => onOpenDoc('MANUAL')} label="User Manual" />
         <MenuOption onClick={() => onOpenDoc('CODE')} label="Code Overview" />
         <MenuOption onClick={() => onOpenDoc('CHANGES')} label="Changes" />
      </MenuItem>
    </div>
  );
};
