/**
 * Converts a JSON Schema object into a formatted Markdown string.
 * It uses headers for structure (Chapters/Subchapters) and lists for details.
 */
export const schemaToMarkdown = (schema: any): string => {
  const lines: string[] = [];

  const addLine = (text: string = '') => lines.push(text);

  const processNode = (node: any, key: string, depth: number, required: boolean = false) => {
    // Determine Header Level (H1 for root, H2, H3, etc.)
    // We cap it at H6 to stay valid markdown
    const headerPrefix = '#'.repeat(Math.min(depth + 1, 6));
    
    // Title/Name
    const title = node.title || key || 'Root Object';
    const typeLabel = node.type ? `\`${node.type}\`` : '';
    const reqLabel = required ? '(Required)' : '(Optional)';
    
    addLine(`${headerPrefix} ${title}`);
    addLine();
    
    // Meta data table/list
    addLine(`**Type**: ${typeLabel} ${reqLabel}  `);
    if (key && key !== title) addLine(`**Property Name**: \`${key}\`  `);
    
    if (node.description) {
      addLine(`**Description**: ${node.description}`);
      addLine();
    }

    // Constraints
    const constraints = [];
    if (node.minLength !== undefined) constraints.push(`Min Length: ${node.minLength}`);
    if (node.maxLength !== undefined) constraints.push(`Max Length: ${node.maxLength}`);
    if (node.minimum !== undefined) constraints.push(`Min: ${node.minimum}`);
    if (node.maximum !== undefined) constraints.push(`Max: ${node.maximum}`);
    if (node.pattern) constraints.push(`Pattern: \`${node.pattern}\``);
    if (node.format) constraints.push(`Format: ${node.format}`);
    if (node.default !== undefined) constraints.push(`Default: \`${JSON.stringify(node.default)}\``);
    
    if (constraints.length > 0) {
      addLine('**Constraints**:');
      constraints.forEach(c => addLine(`- ${c}`));
      addLine();
    }

    // Enums
    if (node.enum) {
      addLine('**Allowed Values**:');
      node.enum.forEach((val: any) => addLine(`- \`${val}\``));
      addLine();
    }

    // Object Properties (Recursion)
    if (node.properties) {
      addLine('**Properties**:');
      addLine();
      const requiredFields = Array.isArray(node.required) ? node.required : [];
      
      Object.entries(node.properties).forEach(([propKey, propNode]: [string, any]) => {
        const isReq = requiredFields.includes(propKey);
        // Recurse with increased depth
        processNode(propNode, propKey, depth + 1, isReq);
      });
    }

    // Array Items (Recursion)
    if (node.items) {
      addLine('**Array Items**:');
      addLine();
      // Handle single schema for items (standard) vs array of schemas (tuple)
      if (Array.isArray(node.items)) {
         node.items.forEach((itemNode: any, idx: number) => {
             processNode(itemNode, `Item [${idx}]`, depth + 1);
         });
      } else {
         processNode(node.items, 'Items', depth + 1);
      }
    }
    
    addLine('---'); // Separator
    addLine();
  };

  // Start processing
  processNode(schema, schema.title || 'Root', 0);

  return lines.join('\n');
};
