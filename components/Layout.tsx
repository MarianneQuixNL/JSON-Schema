

import React, { useState } from 'react';
import { Header } from './Header';
import { MenuBar } from './MenuBar';
import { StatusBar } from './StatusBar';

interface LayoutProps {
  children: React.ReactNode;
  onOpenSettings: () => void;
  onOpenApiKey: () => void;
  onOpenDoc: (id: string) => void;
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

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
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
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />
      <MenuBar 
        onOpenSettings={onOpenSettings} 
        onOpenApiKey={onOpenApiKey} 
        onOpenDoc={onOpenDoc} 
        onClear={onClear}
        onNewSchema={onNewSchema}
        onImportImage={onImportImage}
        onValidate={onValidate}
        onAnalyze={onAnalyze}
        onImproveSchema={onImproveSchema}
        onGenerateCSharp={onGenerateCSharp}
        onGenerateTypeScript={onGenerateTypeScript}
        onGenerateSQL={onGenerateSQL}
        onGenerateData={onGenerateData}
        onPrintSchema={onPrintSchema}
        onSaveMarkdown={onSaveMarkdown}
        onRestructureAll={onRestructureAll}
      />
      <main className="flex-1 overflow-hidden relative bg-dark-bg">
        {children}
      </main>
      <StatusBar />
    </div>
  );
};
