const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const RAW_HTML_DIR = path.join(__dirname, '../raw-scraped/html');
const OUTPUT_DIR = path.join(__dirname, '../src/content/blog/he');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Get all blog HTML files
const files = fs.readdirSync(RAW_HTML_DIR)
  .filter(f => f.startsWith('blog-') && f.endsWith('.html') && f !== 'blog-listing.html');

console.log(`Found ${files.length} blog posts to convert`);

// Load blog listing thumbnails for featured images
const listingMetaPath = path.join(RAW_HTML_DIR, 'blog-listing.meta.json');
const listingThumbnails = {};
if (fs.existsSync(listingMetaPath)) {
  const listingMeta = JSON.parse(fs.readFileSync(listingMetaPath, 'utf-8'));
  listingMeta.images
    .filter(img => img.width > 50 && img.alt)
    .forEach(img => {
      listingThumbnails[img.alt.trim()] = img.local;
    });
}

files.forEach(file => {
  const htmlPath = path.join(RAW_HTML_DIR, file);
  const metaPath = htmlPath.replace('.html', '.meta.json');
  
  // Read HTML and metadata
  let html = fs.readFileSync(htmlPath, 'utf-8');
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf-8')) : {};
  
  // Strip CSS
  html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  html = html.replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, '');
  
  // Parse with JSDOM
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  
  // Extract title
  const titleEl = doc.querySelector('[data-hook="post-title"]');
  const title = titleEl ? titleEl.textContent.trim() : file.replace('blog-', '').replace('.html', '');
  
  // Generate clean slug
  const slug = file.replace('blog-', '').replace('.html', '');
  
  // Extract date
  const dateEl = doc.querySelector('[data-hook="time-ago"]');
  let pubDate = new Date().toISOString().split('T')[0];
  if (dateEl) {
    const dateText = dateEl.textContent || dateEl.getAttribute('title') || '';
    const monthMap = {
      'ינו': '01', 'פבר': '02', 'מרץ': '03', 'אפר': '04',
      'מאי': '05', 'יונ': '06', 'יול': '07', 'אוג': '08',
      'ספט': '09', 'אוק': '10', 'נוב': '11', 'דצמ': '12'
    };
    
    let match = dateText.match(/(\d+)\s+ב([\u05d0-\u05ea]+).*?(\d{4})/);
    if (match) {
      const day = match[1];
      const year = match[3];
      const monthKey = match[2].substring(0, 3);
      const month = monthMap[monthKey] || '01';
      pubDate = `${year}-${month}-${day.padStart(2, '0')}`;
    } else {
      match = dateText.match(/(\d+)\s+ב([\u05d0-\u05ea]+)/);
      if (match && meta.scrapedAt) {
        const day = match[1];
        const year = new Date(meta.scrapedAt).getFullYear();
        const monthKey = match[2].substring(0, 3);
        const month = monthMap[monthKey] || '01';
        pubDate = `${year}-${month}-${day.padStart(2, '0')}`;
      }
    }
  }
  
  // Extract author
  const authorEl = doc.querySelector('[data-hook="user-name"]');
  const author = authorEl ? authorEl.textContent.trim() : 'Ron Geva';
  
  // Extract reading time
  const readingTimeEl = doc.querySelector('[data-hook="time-to-read"]');
  const readingTime = readingTimeEl ? readingTimeEl.textContent.trim() : '';
  
  // Extract counters
  const viewsMatch = html.match(/(\d+)\s*צפיות/);
  const views = viewsMatch ? parseInt(viewsMatch[1]) : 0;
  
  const commentsMatch = html.match(/(\d+)\s*תגובות/);
  const comments = commentsMatch ? parseInt(commentsMatch[1]) : 0;
  
  const likesMatch = html.match(/(\d+)\s*לייקים/);
  const likes = likesMatch ? parseInt(likesMatch[1]) : 0;
  
  // Extract text content
  const contentDiv = doc.querySelector('[data-hook="post-description"]');
  let textContent = '';
  let description = '';
  
  if (contentDiv) {
    // Get all paragraph elements
    const paragraphs = contentDiv.querySelectorAll('p');
    const textBlocks = [];
    
    paragraphs.forEach(p => {
      const text = p.textContent.trim();
      if (text && !text.match(/^(לייקים|צפיות|תגובות)/)) {
        textBlocks.push(text);
      }
    });
    
    textContent = textBlocks.join('\n\n');
    description = textBlocks[0]?.substring(0, 150) || title.substring(0, 150);
  }
  
  // Get content images from metadata (skip social icons and header)
  const contentImages = meta.images ? meta.images.filter(img => 
    img.width > 50 && 
    img.height > 50 && 
    !img.local.includes('puppet') &&
    !img.alt.match(/linkedin|whatsapp|instagram|facebook|תמונת הסופר/i)
  ) : [];
  
  // Build markdown content with images inserted
  let markdownContent = textContent;
  
  // Insert images after text
  if (contentImages.length > 0) {
    markdownContent += '\n\n';
    contentImages.forEach(img => {
      markdownContent += `![${img.alt || ''}](/images/${img.local})\n\n`;
    });
  }
  
  // Get featured image
  let featuredImagePath = '';
  const listingThumbnail = listingThumbnails[title];
  if (listingThumbnail) {
    featuredImagePath = `/images/${listingThumbnail}`;
  } else if (contentImages[0]?.local) {
    featuredImagePath = `/images/${contentImages[0].local}`;
  }
  
  // Escape YAML strings
  const escapeYaml = (str) => {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  };
  
  // Build final markdown file
  const markdown = `---
title: "${escapeYaml(title)}"
pubDate: ${pubDate}
author: "${escapeYaml(author)}"
readingTime: "${escapeYaml(readingTime)}"
description: "${escapeYaml(description)}"
featuredImage: "${featuredImagePath}"
views: ${views}
comments: ${comments}
likes: ${likes}
draft: false
---

${markdownContent}
`;

  // Write markdown file
  const outputPath = path.join(OUTPUT_DIR, `${slug}.md`);
  fs.writeFileSync(outputPath, markdown);
  
  console.log(`✓ Converted: ${title}`);
});

console.log(`\n✅ Successfully converted ${files.length} blog posts to markdown`);
