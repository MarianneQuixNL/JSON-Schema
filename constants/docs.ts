
export const DOC_SYSTEM_INSTRUCTIONS = `# System Instructions

## Overview
This document outlines the core operational directives for the Katje JSON Schemes. It serves as the "single source of truth" for the AI's understanding of the application's intended behavior.

## Core Directives
1. **Architecture**: The application follows a strict Separation of Concerns. Logic, View, and Data are decoupled.
2. **UI Guidelines**: 
   - Dark mode with lavender accents.
   - 95vw/95vh dialogs.
   - No system alerts.
3. **Job Management**:
   - Max 5 concurrent jobs.
   - Statuses: Pending, Running, Finished, Failed.

## Updates
This document is updated dynamically as the application evolves.
`;

export const DOC_USER_MANUAL = `# User Manual

## Introduction
Welcome to the Katje JSON Schemes. This tool allows you to orchestrate AI tasks using various Google Cloud AI services.

## Getting Started
1. **Set API Key**: Go to Settings -> API Key to configure your access.
2. **Creating Jobs**: Use the main area to input your prompts.
3. **Monitoring**: Watch the status bar for job progress.

## Menus
- **File**: Clear workspace.
- **Settings**: Configure keys, View Console.
- **Documents**: Access this manual and other docs.
`;

export const DOC_CODE_OVERVIEW = `# Code Overview

## Structure
- \`/components\`: UI elements (Buttons, Dialogs).
- \`/services\`: Business logic (API calls, Job Queue).
- \`/hooks\`: React state logic.
- \`/constants\`: Static data.

## Key Modules
### JobManager
Handles the execution queue. Ensures only 5 jobs run at once.

### Services
Independent modules for Gemini, Imagen, Veo, etc.
`;

export const DOC_CHANGES = `# Change Log

## [Latest Update]
**Request:** The title has changed to "Katje JSON Schemes".
**Changes:**
- Updated application title in \`index.html\`.
- Updated main header in \`Header.tsx\`.
- Updated system prompt instructions and documentation references to reflect the new name.

## [Previous Version]
- Initial release of the Katje AI Workspace.
- Implemented Job Queue.
- Added Service layers for Google APIs.
- Integrated Tailwind styling.
`;