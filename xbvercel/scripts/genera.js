function generateSimplifiedFileTreeForAI() {
    const root = { name: '', type: 'folder', children: [], path: '' };
    const allPaths = Object.keys(projectFilesData).filter(p => p !== CONVERSATION_FILENAME);

    // Populate a temporary tree structure
    allPaths.forEach(fullPath => {
        const parts = fullPath.split('/').filter(p => p !== ''); // Filter out empty strings from split
        let currentNode = root;
        let currentPathAccumulator = '';

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            currentPathAccumulator += part + (i < parts.length - 1 || fullPath.endsWith('/') ? '/' : '');

            let childNode = currentNode.children.find(child => child.name === part);
            if (!childNode) {
                childNode = { name: part, type: (i === parts.length - 1 && !fullPath.endsWith('/')) ? 'file' : 'folder', children: [], path: currentPathAccumulator };
                currentNode.children.push(childNode);
            }
            currentNode = childNode;
        }
    });

    let treeString = '';
    const indent = (level) => '  '.repeat(level);

    function buildString(node, level) {
        if (node.name !== '') { // Don't list the invisible root
            treeString += `${indent(level-1)}${node.type === 'folder' ? '📁' : '📄'} ${node.name}/\n`;
        }
        
        // Sort children for consistent output
        node.children.sort((a, b) => {
            if (a.type === 'folder' && b.type === 'file') return -1;
            if (a.type === 'file' && b.type === 'folder') return 1;
            return a.name.localeCompare(b.name);
        }).forEach(child => {
            if (level < 2 || child.type === 'file') { // Show up to 2 levels deep, always show files at any level if they exist there
                if (child.type === 'file') {
                    treeString += `${indent(level)}📄 ${child.name}\n`;
                } else if (level < 2) {
                    buildString(child, level + 1);
                }
            } else if (level === 2 && child.type === 'folder') {
                treeString += `${indent(level)}📁 ${child.name}/ (and more...)\n`;
            }
        });
    }

    buildString(root, 0); // Start building from root, level 0

    // Add the important reminders section
    treeString += `\n\n--- IMPORTANT REMINDER FOR ANESHA ---\n`;
    treeString += `To perform file or GitHub operations, you MUST output a JSON block formatted EXACTLY as follows:\n\n`;
    treeString += `°°°°\n`;
    treeString += `\`\`\`json\n`;
    treeString += `{\n`;
    treeString += `  "action": "create" | "update" | "delete" | "mkdir" | "mvfile" | "github_create_file" | ...,\n`;
    treeString += `  "path": "path/to/target.ext",\n`;
    treeString += `  "has_content_block": true | false,\n`;
    treeString += `  "content": "Optional short, JSON-escaped text if has_content_block is false",\n`;
    treeString += `  // ... other action-specific fields as needed\n`;
    treeString += `}\n`;
    treeString += `\`\`\`\n`;
    treeString += `°°°°\n\n`;
    treeString += `If 'has_content_block' is true, immediately follow the JSON block with the raw content block, also delimited by four °°°°.\n`;
    treeString += `Example for content block:\n`;
    treeString += `°°°°\n`;
    treeString += `This is the raw content.\nIt can have newlines, "quotes", and \\backslashes directly.\n`;
    treeString += `°°°°\n\n`;
    treeString += `Ensure the JSON is always wrapped in \`\`\`json and \`\`\` markdown, and the entire action block (including any content block) is wrapped in FOUR delimiters (°°°°).\n`;
    treeString += `--- End Reminder ---`;

    return treeString.trim();
}