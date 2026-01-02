const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const blogDir = path.join(__dirname, '../src/content/blog/he');
const files = fs.readdirSync(blogDir).filter(f => f.endsWith('.md'));

console.log(`Found ${files.length} blog files to fix`);

files.forEach(filename => {
  const filePath = path.join(blogDir, filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Split frontmatter and body
  const parts = content.split('---');
  if (parts.length < 3) {
    console.log(`Skipping ${filename} - no valid frontmatter`);
    return;
  }
  
  const frontmatterRaw = parts[1];
  const body = parts.slice(2).join('---');
  
  try {
    // Parse the frontmatter
    const data = yaml.load(frontmatterRaw);
    
    // Manually build frontmatter with proper formatting for long fields
    let newFrontmatter = '';
    
    for (const [key, value] of Object.entries(data)) {
      if (key === 'htmlContent' && value && value.length > 100) {
        // Use literal block scalar (|) for long HTML content
        newFrontmatter += `${key}: |\n`;
        newFrontmatter += `  ${value}\n`;
      } else if (key === 'description' && value && value.length > 80) {
        // Use folded block scalar (>) for long descriptions
        newFrontmatter += `${key}: >\n`;
        newFrontmatter += `  ${value}\n`;
      } else if (typeof value === 'string') {
        // Quote strings if they contain special characters
        if (value.includes(':') || value.includes('#') || value.includes('\n')) {
          newFrontmatter += `${key}: "${value.replace(/"/g, '\\"')}"\n`;
        } else {
          newFrontmatter += `${key}: ${value}\n`;
        }
      } else if (typeof value === 'boolean') {
        newFrontmatter += `${key}: ${value}\n`;
      } else if (typeof value === 'number') {
        newFrontmatter += `${key}: ${value}\n`;
      } else if (value instanceof Date) {
        newFrontmatter += `${key}: ${value.toISOString()}\n`;
      } else if (value === null || value === undefined) {
        // Skip null/undefined values
      } else {
        newFrontmatter += `${key}: ${JSON.stringify(value)}\n`;
      }
    }
    
    // Write back
    const newContent = `---\n${newFrontmatter}---${body}`;
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`✓ Fixed ${filename}`);
    
  } catch (error) {
    console.error(`✗ Error parsing ${filename}:`, error.message);
  }
});

console.log('Done!');
