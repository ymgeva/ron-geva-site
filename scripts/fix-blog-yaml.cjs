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
    
    // Convert htmlContent to proper YAML literal block scalar if it exists and is long
    const newFrontmatter = yaml.dump(data, {
      lineWidth: -1, // Don't wrap lines
      noRefs: true,
      quotingType: '"',
      forceQuotes: false,
    });
    
    // Write back
    const newContent = `---\n${newFrontmatter}---${body}`;
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`✓ Fixed ${filename}`);
    
  } catch (error) {
    console.error(`✗ Error parsing ${filename}:`, error.message);
  }
});

console.log('Done!');
