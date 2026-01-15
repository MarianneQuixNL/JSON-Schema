

import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dialog } from './components/Dialog';
import { ConsoleDialog } from './components/ConsoleDialog';
import { MarkdownViewer } from './components/MarkdownViewer';
import { LeftSidebar } from './components/LeftSidebar';
import { RightSidebar } from './components/RightSidebar';
import { MainWorkspace } from './components/MainWorkspace';
import { logger } from './services/logger.service';
import { jsonBuilderService } from './services/jsonBuilder.service';
import { jobManager } from './services/jobManager.service';
import { geminiService } from './services/gemini.service';
import { visionService } from './services/vision.service';
import { SYSTEM_INSTRUCTIONS } from './constants/prompts';
import { schemaToMarkdown } from './utils/schemaToMarkdown.utils';
import { ImprovementDialog } from './components/ImprovementDialog';
import { SchemaImprovement } from './types';
import { 
  DOC_SYSTEM_INSTRUCTIONS, 
  DOC_USER_MANUAL, 
  DOC_CODE_OVERVIEW, 
  DOC_CHANGES 
} from './constants/docs';
import { Upload } from 'lucide-react';

const App: React.FC = () => {
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [docContent, setDocContent] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState('');
  
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  // Report State
  const [reportOpen, setReportOpen] = useState(false);
  const [reportContent, setReportContent] = useState('');

  // Image Import State
  const [imageImportOpen, setImageImportOpen] = useState(false);
  const [pastedImage, setPastedImage] = useState<string | null>(null);

  // Improvement State
  const [improvementsOpen, setImprovementsOpen] = useState(false);
  const [improvementsList, setImprovementsList] = useState<SchemaImprovement[]>([]);
  const [improvementsLoading, setImprovementsLoading] = useState(false);

  const showAlert = (message: string) => {
      setAlertMessage(message);
      setAlertOpen(true);
  };
  
  const handleOpenDoc = (id: string) => {
    switch (id) {
      case 'SYSTEM': setDocTitle('System Instructions'); setDocContent(DOC_SYSTEM_INSTRUCTIONS); break;
      case 'MANUAL': setDocTitle('User Manual'); setDocContent(DOC_USER_MANUAL); break;
      case 'CODE': setDocTitle('Code Overview'); setDocContent(DOC_CODE_OVERVIEW); break;
      case 'CHANGES': setDocTitle('Changes'); setDocContent(DOC_CHANGES); break;
    }
  };

  const handleClear = () => {
    jsonBuilderService.clear();
    logger.log('INFO', 'User triggered workspace clear', null);
  };

  const handleNewSchema = () => {
    jsonBuilderService.resetSchema();
  };

  // --- Image Handling ---
  const handlePasteImage = (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
              const blob = items[i].getAsFile();
              if (blob) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                      setPastedImage(event.target?.result as string);
                  };
                  reader.readAsDataURL(blob);
              }
          }
      }
  };

  const processImportImage = () => {
      if (!pastedImage) return;
      setImageImportOpen(false);

      // Extract base64 and mime
      const match = pastedImage.match(/^data:(image\/[a-z]+);base64,(.*)$/);
      if (!match) return;

      const mimeType = match[1];
      const base64Data = match[2];

      jobManager.addJob(
          'Generate Schema from Image',
          ['Analyze Image with Vision Model', 'Generate JSON Schema'],
          async (job) => {
               const schema = await visionService.generateSchemaFromImage(base64Data, mimeType);
               jsonBuilderService.updateSchema(schema, 'Imported from Image Analysis');
               if (schema.title) jsonBuilderService.setSchemaName(schema.title);
               return "Schema generated from image";
          },
          SYSTEM_INSTRUCTIONS
      );
      setPastedImage(null);
  };

  // --- Schema Actions ---

  const handleAnalyze = async () => {
    const selected = jsonBuilderService.getSelectedFile();
    if (!selected) {
        showAlert("Please select a source file (or group) from the sidebar to analyze.");
        return;
    }
    
    jobManager.addJob(
        `Analyze ${selected.name}`,
        ['Gather Content', 'Analyze structure', 'Update Schema', 'Determine Schema Name'],
        async (job) => {
            const currentSchema = jsonBuilderService.getSchema();
            
            // Handle Groups: Get aggregated content
            const contentToAnalyze = jsonBuilderService.getAggregateContent(selected);
            
            const newSchema = await geminiService.analyzeAndCreateSchema(contentToAnalyze, currentSchema, job);
            jsonBuilderService.updateSchema(newSchema, 'Analysis of ' + selected.name);
            
            // Auto-update schema name if AI determined one
            if (newSchema.title) {
                jsonBuilderService.setSchemaName(newSchema.title);
            }
            
            return "Schema Updated";
        },
        SYSTEM_INSTRUCTIONS
    );
  };

  const handleImproveSchema = async () => {
      const schemaName = jsonBuilderService.getSchemaName();

      // Check cache first
      const cached = jsonBuilderService.getCachedImprovements();
      if (cached && cached.length > 0) {
          setImprovementsList(cached);
          setImprovementsOpen(true);
          return;
      }

      jobManager.addJob(
          `Analyze Improvements: ${schemaName}`,
          ['Analyze Schema Structure', 'Check Naming Conventions', 'Identify Missing Types', 'Suggest Extensions'],
          async (job) => {
              const currentSchema = jsonBuilderService.getSchema();
              const improvements = await geminiService.getImprovements(currentSchema, job);
              
              if (improvements.length > 0) {
                  setImprovementsList(improvements);
                  jsonBuilderService.setCachedImprovements(improvements);
                  setImprovementsOpen(true);
                  return `${improvements.length} improvements found.`;
              } else {
                  return "No new improvements found.";
              }
          },
          SYSTEM_INSTRUCTIONS
      );
  };

  const handleApplyImprovements = async (selectedIds: string[]) => {
      if (selectedIds.length === 0) return;
      
      setImprovementsLoading(true);

      const selectedImprovements = improvementsList.filter(i => selectedIds.includes(i.id));
      const schemaName = jsonBuilderService.getSchemaName();

      jobManager.addJob(
          `Apply Improvements: ${schemaName}`,
          ['Apply Selected Improvements', 'Auto-Download Backup', 'Regenerate Schema'],
          async (job) => {
              try {
                const currentSchema = jsonBuilderService.getSchema();
                const newSchema = await geminiService.applyImprovements(currentSchema, selectedImprovements, job);
                
                jsonBuilderService.updateSchema(newSchema, 'Applied AI Improvements');
                
                try {
                    const blob = new Blob([JSON.stringify(newSchema, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${schemaName}_improved_${Date.now()}.json`;
                    a.click();
                    logger.log('INFO', 'Auto-downloaded improved schema', null);
                } catch (e) {
                    logger.log('ERROR', 'Failed to auto-download schema', e);
                }

                jsonBuilderService.clearCachedImprovements();
                
                const nextImprovements = await geminiService.getImprovements(newSchema, job);
                setImprovementsList(nextImprovements);
                jsonBuilderService.setCachedImprovements(nextImprovements);
                setImprovementsLoading(false);
                
                if (nextImprovements.length === 0) {
                    setImprovementsOpen(false);
                    return "Improvements applied. No further suggestions.";
                }

                return "Improvements applied. New options ready.";

              } catch (e: any) {
                  setImprovementsLoading(false);
                  throw e;
              }
          },
          SYSTEM_INSTRUCTIONS
      );
  };

  const handleRestructureAll = async () => {
      const allFiles = jsonBuilderService.getAllFilesFlat();
      if (allFiles.length === 0) {
          showAlert("No files available to restructure.");
          return;
      }
      
      jobManager.addJob(
          `Restructure All (${allFiles.length} files)`,
          ['Iterate Files', 'Map to Current Schema', 'Update Mapped Content'],
          async (job) => {
              const currentSchema = jsonBuilderService.getSchema();
              let processed = 0;
              
              for (const file of allFiles) {
                  // Skip if it's a container group without content
                  if (file.children && !file.content) continue;
                  
                  try {
                       const mapped = await geminiService.mapJson(file.content, currentSchema, job);
                       jsonBuilderService.setMapping(file.id, mapped);
                       processed++;
                  } catch (e) {
                      logger.log('ERROR', `Failed to map file ${file.name}`, e);
                  }
              }
              return `Restructured ${processed} files.`;
          },
          SYSTEM_INSTRUCTIONS
      );
  };

  const handleValidate = async () => {
    const schemaName = jsonBuilderService.getSchemaName();
    jobManager.addJob(
        `Validate ${schemaName}`,
        ['Analyze Schema Validity', 'Check Logic', 'Generate Report'],
        async (job) => {
            const currentSchema = jsonBuilderService.getSchema();
            const report = await geminiService.validateSchema(currentSchema, job);
            setReportContent(report);
            setReportOpen(true);
            return "Validation Complete";
        },
        SYSTEM_INSTRUCTIONS
    );
  };

  const handleGenerateCSharp = async () => {
    const schemaName = jsonBuilderService.getSchemaName();
    jobManager.addJob(
        `Generate C#: ${schemaName}`,
        ['Generate C# 14 Code', 'Map Schema to Classes', 'Add Attributes'],
        async (job) => {
            const currentSchema = jsonBuilderService.getSchema();
            const code = await geminiService.generateCSharp(currentSchema, schemaName, job);
            
            const blob = new Blob([code], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${schemaName}.cs`;
            a.click();
            
            return "Code Generated & Downloaded";
        },
        SYSTEM_INSTRUCTIONS
    );
  };

  const handleGenerateTypeScript = async () => {
    const schemaName = jsonBuilderService.getSchemaName();
    jobManager.addJob(
        `Generate TS: ${schemaName}`,
        ['Generate TypeScript Interfaces', 'Map Types'],
        async (job) => {
            const currentSchema = jsonBuilderService.getSchema();
            const code = await geminiService.generateTypeScript(currentSchema, job);
            
            const blob = new Blob([code], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${schemaName}.ts`;
            a.click();
            
            return "TypeScript Generated & Downloaded";
        },
        SYSTEM_INSTRUCTIONS
    );
  };

  const handleGenerateSQL = async () => {
    const schemaName = jsonBuilderService.getSchemaName();
    jobManager.addJob(
        `Generate SQL: ${schemaName}`,
        ['Generate SQL DDL', 'Map Structure to Tables'],
        async (job) => {
            const currentSchema = jsonBuilderService.getSchema();
            const code = await geminiService.generateSQL(currentSchema, job);
            
            const blob = new Blob([code], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${schemaName}.sql`;
            a.click();
            
            return "SQL Generated & Downloaded";
        },
        SYSTEM_INSTRUCTIONS
    );
  };

  const handleGenerateData = async () => {
      const schemaName = jsonBuilderService.getSchemaName();
      jobManager.addJob(
        `Gen Data: ${schemaName}`,
        ['Analyze Schema', 'Generate Realistic Synthetic Data', 'Add to Workspace', 'Select File'],
        async (job) => {
            const currentSchema = jsonBuilderService.getSchema();
            const prompt = "Generate a proper-looking JSON file with realistic synthetic data that validates against this schema.";
            const syntheticData = await geminiService.generateSyntheticData(currentSchema, prompt, job);
            
            // Add as file and select it
            const fileName = `${schemaName}_generated_${Date.now()}.json`;
            const newFileId = jsonBuilderService.addFile(fileName, syntheticData);
            jsonBuilderService.selectFile(newFileId);
            
            return "Data Generated, Added and Selected";
        },
        SYSTEM_INSTRUCTIONS
      );
  };

  const handlePrintSchema = () => {
    const currentSchema = jsonBuilderService.getSchema();
    const markdown = schemaToMarkdown(currentSchema);
    handlePrint(markdown, jsonBuilderService.getSchemaName() || "Schema");
  };

  const handleSaveMarkdown = () => {
    const currentSchema = jsonBuilderService.getSchema();
    const markdown = schemaToMarkdown(currentSchema);
    const name = jsonBuilderService.getSchemaName() || "Schema";
    
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.md`;
    a.click();
  };

  const handleApiKeySelect = async () => {
    try {
        if ((window as any).aistudio) {
            await (window as any).aistudio.openSelectKey();
            const hasKey = await (window as any).aistudio.hasSelectedApiKey();
            if (hasKey) {
                logger.log('INFO', 'API Key selection updated via AI Studio', null);
            }
        } else {
             logger.log('ERROR', 'AI Studio Object not found', null);
             showAlert("AI Studio environment not detected.");
        }
    } catch (e: any) {
        logger.log('ERROR', 'Failed to select API key', e);
        if (e.message?.includes('Requested entity was not found')) {
            showAlert("Session expired or invalid. Please try selecting the key again.");
        }
    }
  };

  const parseMarkdownToHtml = (md: string): string => {
      let html = md
        .replace(/^###### (.*$)/gim, '<h6>$1</h6>')
        .replace(/^##### (.*$)/gim, '<h5>$1</h5>')
        .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
        .replace(/`([^`]*)`/gim, '<code>$1</code>')
        .replace(/^---$/gim, '<hr />')
        .replace(/^- (.*$)/gim, '<ul><li>$1</li></ul>')
        .replace(/\n/gim, '<br />');
      return html;
  };

  const handlePrint = (content: string, title: string) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        let bodyContent = '';
        if (content.startsWith('#')) {
             bodyContent = `<div class="markdown-body">${parseMarkdownToHtml(content)}</div>`;
        } else {
            bodyContent = `<pre>${content}</pre>`;
        }

        printWindow.document.write(`
            <html>
            <head>
                <title>Print: ${title}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; padding: 40px; line-height: 1.6; color: #1a1a1a; }
                    h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; margin-bottom: 24px; margin-top: 10px; }
                    h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; margin-top: 24px; margin-bottom: 16px; }
                    h3 { font-size: 1.25em; margin-top: 24px; margin-bottom: 16px; font-weight: 600; }
                    p, ul, ol { margin-bottom: 16px; }
                    code { background: #f6f8fa; padding: 0.2em 0.4em; border-radius: 3px; font-family: monospace; font-size: 85%; }
                    pre { background: #f6f8fa; padding: 16px; border-radius: 6px; font-family: monospace; white-space: pre-wrap; margin-bottom: 16px; }
                    ul { padding-left: 20px; list-style-type: disc; }
                    li { margin-bottom: 4px; }
                    hr { height: 0.25em; padding: 0; margin: 24px 0; background-color: #e1e4e8; border: 0; }
                    ul + ul { margin-top: -16px; } 
                </style>
            </head>
            <body>
                ${bodyContent}
                <script>
                    window.onload = function() { window.print(); window.close(); }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }
  };

  return (
    <Layout
      onOpenSettings={() => setConsoleOpen(true)}
      onOpenApiKey={handleApiKeySelect}
      onOpenDoc={handleOpenDoc}
      onClear={handleClear}
      onNewSchema={handleNewSchema}
      onImportImage={() => setImageImportOpen(true)}
      onValidate={handleValidate}
      onAnalyze={handleAnalyze}
      onImproveSchema={handleImproveSchema}
      onGenerateCSharp={handleGenerateCSharp}
      onGenerateTypeScript={handleGenerateTypeScript}
      onGenerateSQL={handleGenerateSQL}
      onGenerateData={handleGenerateData}
      onPrintSchema={handlePrintSchema}
      onSaveMarkdown={handleSaveMarkdown}
      onRestructureAll={handleRestructureAll}
    >
      <div className="flex h-full w-full">
        <LeftSidebar />
        <MainWorkspace />
        <RightSidebar />
      </div>

      {/* Dialogs */}
      <ConsoleDialog isOpen={consoleOpen} onClose={() => setConsoleOpen(false)} />
      
      <Dialog 
        isOpen={!!docContent} 
        title={docTitle} 
        onClose={() => setDocContent(null)}
        onOk={() => setDocContent(null)} 
        okText="Close"
        onPrint={() => docContent && handlePrint(docContent, docTitle)}
        type="MARKDOWN_VIEWER"
      >
        {docContent && <MarkdownViewer content={docContent} />}
      </Dialog>
      
      <Dialog 
         isOpen={alertOpen}
         title="System Alert"
         onClose={() => setAlertOpen(false)}
         onOk={() => setAlertOpen(false)}
         okText="Close"
         type="ALERT"
      >
          <div className="p-6 flex items-center justify-center">
              <p className="text-lg text-center">{alertMessage}</p>
          </div>
      </Dialog>

      <Dialog
        isOpen={reportOpen}
        title="Schema Validation Report"
        onClose={() => setReportOpen(false)}
        onOk={() => setReportOpen(false)}
        okText="Close"
        type="MARKDOWN_VIEWER"
        onPrint={() => handlePrint(reportContent, "Validation Report")}
      >
          <MarkdownViewer content={reportContent} />
      </Dialog>

      <Dialog
        isOpen={imageImportOpen}
        title="Import Schema from Image"
        onClose={() => setImageImportOpen(false)}
        onOk={processImportImage}
        okText="Generate Schema"
      >
          <div 
             className="p-6 flex flex-col items-center justify-center gap-4 h-full"
             onPaste={handlePasteImage}
          >
              <div className="border-2 border-dashed border-purple-500 rounded-lg w-full h-64 flex flex-col items-center justify-center bg-dark-bg p-4 overflow-hidden relative">
                  {pastedImage ? (
                      <img src={pastedImage} className="max-h-full max-w-full object-contain" />
                  ) : (
                      <>
                        <Upload size={48} className="text-purple-400 mb-2" />
                        <p className="text-gray-400 text-sm">Paste an image here (Ctrl+V)</p>
                      </>
                  )}
              </div>
              <p className="text-xs text-gray-500 text-center">
                  Take a screenshot of a form, receipt, or data table and paste it above.<br/>
                  The AI will analyze it and generate a JSON Schema.
              </p>
          </div>
      </Dialog>

      <ImprovementDialog 
          isOpen={improvementsOpen}
          improvements={improvementsList}
          onClose={() => setImprovementsOpen(false)}
          onApply={handleApplyImprovements}
          isProcessing={improvementsLoading}
      />
    </Layout>
  );
};

export default App;
