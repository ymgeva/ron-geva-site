const fs = require('fs');
const path = require('path');

const scrapedDir = path.join(__dirname, '../scraped-content/pages');
const contentDir = path.join(__dirname, '../src/content');

// Helper to extract date from blog content
function extractDateFromContent(markdown, name) {
  // Try to find date in markdown (e.g., "27 בספט׳")
  const dateMatch = markdown.match(/\*\s+(\d+\s+ב[^\*]+)\*/);
  if (dateMatch) {
    const hebrewDate = dateMatch[1];
    // For now, use current year and try to parse Hebrew month
    const year = new Date().getFullYear();
    const monthMap = {
      'בינו': '01',
      'בפבר': '02',
      'במרץ': '03',
      'באפר': '04',
      'במאי': '05',
      'ביוני': '06',
      'ביולי': '07',
      'באוג': '08',
      'בספט': '09',
      'באוק': '10',
      'בנוב': '11',
      'בדצמ': '12'
    };
    
    const day = hebrewDate.match(/(\d+)/)?.[1] || '01';
    let month = '01';
    for (const [key, value] of Object.entries(monthMap)) {
      if (hebrewDate.includes(key)) {
        month = value;
        break;
      }
    }
    
    return `${year}-${month}-${day.padStart(2, '0')}`;
  }
  
  // Fallback: use file stats
  try {
    const stats = fs.statSync(path.join(scrapedDir, name + '.json'));
    return stats.mtime.toISOString().split('T')[0];
  } catch (e) {
    return new Date().toISOString().split('T')[0];
  }
}

// Helper to clean markdown and fix image paths
function cleanMarkdown(markdown) {
  // Remove Wix-specific HTML/JS
  let cleaned = markdown.replace(/#pro-gallery[^\n]+/g, '');
  cleaned = cleaned.replace(/try \{ window\.requestAnimationFrame[\s\S]*?\} catch[^}]+\}/g, '');
  
  // Remove view counts and comment counts
  cleaned = cleaned.replace(/\n\d+\n\n\d+ צפיות\n/g, '\n');
  cleaned = cleaned.replace(/\n\d+\n\n\d+ תגובות?\n/g, '\n');
  cleaned = cleaned.replace(/הפוסט לא סומן בלייק\n/g, '');
  cleaned = cleaned.replace(/\d+ לייק\. הפוסט לא סומן בלייק/g, '');
  
  // Remove blog metadata from top (author link, date, reading time)
  cleaned = cleaned.replace(/\*\s+\[.*?\]\(https:\/\/www\.rongogeva\.com\/profile.*?\)\n/g, '');
  cleaned = cleaned.replace(/\*\s+\d+\s+ב[^\n]+\n/g, '');
  cleaned = cleaned.replace(/\*\s+זמן קריאה.*?\n/g, '');
  
  // Remove comments section
  cleaned = cleaned.replace(/## תגובות\n[\s\S]*כתיבת תגובה\.\.\.כתיבת תגובה\.\.\./g, '');
  
  // Remove extra whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return cleaned.trim();
}

// Import blog posts
function importBlogPosts() {
  console.log('\n📝 Importing blog posts...');
  
  const blogFiles = fs.readdirSync(scrapedDir).filter(f => f.startsWith('blog-') && f.endsWith('.json'));
  const heDir = path.join(contentDir, 'blog/he');
  
  if (!fs.existsSync(heDir)) {
    fs.mkdirSync(heDir, { recursive: true });
  }
  
  blogFiles.forEach(file => {
    const name = file.replace('.json', '');
    const data = JSON.parse(fs.readFileSync(path.join(scrapedDir, file), 'utf8'));
    
    // Extract slug from name (remove 'blog-' prefix)
    const slug = name.replace('blog-', '');
    
    // Get featured image (first image from images array)
    const featuredImage = data.images && data.images.length > 0 
      ? `/images/${data.images[0].local}` 
      : '';
    
    // Clean markdown and replace image URLs
    let markdown = cleanMarkdown(data.markdown);
    
    // Replace image URLs with local paths
    if (data.images) {
      data.images.forEach(img => {
        markdown = markdown.replace(img.original, `/images/${img.local}`);
      });
    }
    
    // Extract description from first real content paragraph (skip title)
    const lines = markdown.split('\n');
    let description = '';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Skip empty lines, titles, and very short lines
      if (line && !line.startsWith('#') && line.length > 20 && !line.startsWith('![')) {
        description = line.substring(0, 150);
        break;
      }
    }
    if (!description) {
      description = data.title || slug;
    }
    
    // Get publish date
    const pubDate = extractDateFromContent(data.markdown, name);
    
    // Escape quotes in strings for YAML
    const escapeYaml = (str) => {
      if (!str) return '""';
      // If string contains quotes or special chars, use single quotes and escape single quotes
      if (str.includes('"') || str.includes(':') || str.includes('#')) {
        return `'${str.replace(/'/g, "''")}'`;
      }
      return `"${str}"`;
    };
    
    // Create frontmatter
    const frontmatter = `---
title: ${escapeYaml(data.title || slug)}
pubDate: ${pubDate}
description: ${escapeYaml(description)}
author: "Ron Geva"
${featuredImage ? `featuredImage: "${featuredImage}"` : ''}
draft: false
---

${markdown}
`;
    
    // Write file
    const outputPath = path.join(heDir, `${slug}.md`);
    fs.writeFileSync(outputPath, frontmatter);
    console.log(`  ✓ Created: blog/he/${slug}.md`);
  });
}

// Import pages
function importPages() {
  console.log('\n📄 Importing pages...');
  
  const pageFiles = ['about', 'book', 'alligators'];
  const heDir = path.join(contentDir, 'pages/he');
  
  if (!fs.existsSync(heDir)) {
    fs.mkdirSync(heDir, { recursive: true });
  }
  
  pageFiles.forEach(pageName => {
    const jsonPath = path.join(scrapedDir, `${pageName}.json`);
    if (!fs.existsSync(jsonPath)) {
      console.log(`  ⚠ Skipping ${pageName} - file not found`);
      return;
    }
    
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    
    // Get featured image
    const featuredImage = data.images && data.images.length > 0 
      ? `/images/${data.images[0].local}` 
      : '';
    
    // Clean markdown and replace image URLs
    let markdown = cleanMarkdown(data.markdown);
    
    if (data.images) {
      data.images.forEach(img => {
        markdown = markdown.replace(img.original, `/images/${img.local}`);
      });
    }
    
    // Extract description
    const descMatch = markdown.match(/^#[^\n]+\n+([^\n]+)/);
    const description = descMatch ? descMatch[1].substring(0, 150) : (data.title || pageName);
    
    // Escape quotes in strings for YAML
    const escapeYaml = (str) => {
      if (!str) return '""';
      // If string contains quotes or special chars, use single quotes and escape single quotes
      if (str.includes('"') || str.includes(':') || str.includes('#')) {
        return `'${str.replace(/'/g, "''")}'`;
      }
      return `"${str}"`;
    };
    
    // Create frontmatter
    const frontmatter = `---
title: ${escapeYaml(data.title || pageName)}
description: ${escapeYaml(description)}
${featuredImage ? `featuredImage: "${featuredImage}"` : ''}
---

${markdown}
`;
    
    // Write file
    const outputPath = path.join(heDir, `${pageName}.md`);
    fs.writeFileSync(outputPath, frontmatter);
    console.log(`  ✓ Created: pages/he/${pageName}.md`);
  });
}

// Import artworks
function importArtworks() {
  console.log('\n🎨 Importing artworks...');
  
  const artCategories = {
    'art-color': 'color',
    'art-portraits': 'portraits',
    'art-bw': 'bw',
    'art-sculptures': 'sculptures',
    'art-postcards': 'postcards'
  };
  
  const heDir = path.join(contentDir, 'artworks/he');
  
  if (!fs.existsSync(heDir)) {
    fs.mkdirSync(heDir, { recursive: true });
  }
  
  Object.entries(artCategories).forEach(([fileName, category]) => {
    const jsonPath = path.join(scrapedDir, `${fileName}.json`);
    if (!fs.existsSync(jsonPath)) {
      console.log(`  ⚠ Skipping ${category} - file not found`);
      return;
    }
    
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    
    if (!data.images || data.images.length === 0) {
      console.log(`  ⚠ No images found for ${category}`);
      return;
    }
    
    // Create individual artwork entries for each image
    data.images.forEach((img, index) => {
      const slug = `${category}-${index + 1}`;
      const title = img.alt || `${category} ${index + 1}`;
      
      const frontmatter = `---
title: "${title}"
category: "${category}"
image: "/images/${img.local}"
order: ${index + 1}
---

`;
      
      const outputPath = path.join(heDir, `${slug}.md`);
      fs.writeFileSync(outputPath, frontmatter);
    });
    
    console.log(`  ✓ Created ${data.images.length} artworks in ${category}`);
  });
}

// Main
console.log('🚀 Starting content import...\n');
console.log(`Source: ${scrapedDir}`);
console.log(`Target: ${contentDir}\n`);

try {
  importBlogPosts();
  importPages();
  importArtworks();
  
  console.log('\n✨ Content import complete!\n');
} catch (error) {
  console.error('❌ Error during import:', error);
  process.exit(1);
}
