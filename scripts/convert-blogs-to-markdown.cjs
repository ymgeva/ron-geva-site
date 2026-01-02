const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const RAW_HTML_DIR = path.join(__dirname, '../raw-scraped/html');
const OUTPUT_DIR = path.join(__dirname, '../src/content/blog/he');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Helper to convert HTML to markdown
function htmlToMarkdown(html, imageMap = {}) {
  if (!html) return '';
  
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const body = doc.body;
  
  let markdown = '';
  
  function processNode(node, depth = 0) {
    if (node.nodeType === 3) { // Text node
      const text = node.textContent.trim();
      if (text) markdown += text;
      return;
    }
    
    if (node.nodeType !== 1) return; // Skip non-element nodes
    
    const tag = node.tagName.toLowerCase();
    
    switch (tag) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        const level = parseInt(tag[1]);
        markdown += '\n\n' + '#'.repeat(level) + ' ';
        Array.from(node.childNodes).forEach(child => processNode(child, depth));
        markdown += '\n\n';
        break;
        
      case 'p':
        markdown += '\n\n';
        Array.from(node.childNodes).forEach(child => processNode(child, depth));
        markdown += '\n\n';
        break;
        
      case 'br':
        markdown += '  \n'; // Two spaces + newline for markdown line break
        break;
        
      case 'strong':
      case 'b':
        markdown += '**';
        Array.from(node.childNodes).forEach(child => processNode(child, depth));
        markdown += '**';
        break;
        
      case 'em':
      case 'i':
        markdown += '*';
        Array.from(node.childNodes).forEach(child => processNode(child, depth));
        markdown += '*';
        break;
        
      case 'a':
        const href = node.getAttribute('href') || '#';
        markdown += '[';
        Array.from(node.childNodes).forEach(child => processNode(child, depth));
        markdown += `](${href})`;
        break;
        
      case 'img':
        let src = node.getAttribute('src') || '';
        const alt = node.getAttribute('alt') || '';
        
        // Convert Wix URLs to local paths
        const wixMatch = src.match(/\/(c16946_[^?\/]+)/);
        if (wixMatch) {
          const wixFilename = wixMatch[1];
          const baseName = wixFilename.replace(/~mv2.*$/, '').split('.')[0];
          const localFile = imageMap[wixFilename] || imageMap[baseName + '.jpg'] || imageMap[baseName + '.webp'] || imageMap[baseName + '.png'];
          if (localFile) {
            src = `/images/${localFile}`;
          }
        }
        
        markdown += `\n\n![${alt}](${src})\n\n`;
        break;
        
      case 'ul':
        markdown += '\n';
        Array.from(node.children).forEach(li => {
          if (li.tagName.toLowerCase() === 'li') {
            markdown += '- ';
            Array.from(li.childNodes).forEach(child => processNode(child, depth + 1));
            markdown += '\n';
          }
        });
        markdown += '\n';
        break;
        
      case 'ol':
        markdown += '\n';
        Array.from(node.children).forEach((li, index) => {
          if (li.tagName.toLowerCase() === 'li') {
            markdown += `${index + 1}. `;
            Array.from(li.childNodes).forEach(child => processNode(child, depth + 1));
            markdown += '\n';
          }
        });
        markdown += '\n';
        break;
        
      case 'blockquote':
        markdown += '\n> ';
        Array.from(node.childNodes).forEach(child => processNode(child, depth));
        markdown += '\n\n';
        break;
        
      case 'code':
        markdown += '`';
        markdown += node.textContent;
        markdown += '`';
        break;
        
      case 'pre':
        markdown += '\n```\n';
        markdown += node.textContent;
        markdown += '\n```\n\n';
        break;
        
      case 'div':
        // Check if it's an image grid
        if (node.className && node.className.includes('grid-')) {
          markdown += '\n\n';
          Array.from(node.children).forEach(child => processNode(child, depth));
          markdown += '\n\n';
        } else {
          // Regular div, process children
          Array.from(node.childNodes).forEach(child => processNode(child, depth));
        }
        break;
        
      case 'span':
        // Just process children for span
        Array.from(node.childNodes).forEach(child => processNode(child, depth));
        break;
        
      default:
        // For unknown tags, just process children
        Array.from(node.childNodes).forEach(child => processNode(child, depth));
    }
  }
  
  processNode(body);
  
  // Clean up excessive newlines
  markdown = markdown
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  return markdown;
}

// Load blog listing thumbnails
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

// Get all blog HTML files
const files = fs.readdirSync(RAW_HTML_DIR)
  .filter(f => f.startsWith('blog-') && f.endsWith('.html') && f !== 'blog-listing.html');

console.log(`Found ${files.length} blog posts to convert`);

files.forEach(file => {
  const htmlPath = path.join(RAW_HTML_DIR, file);
  const metaPath = htmlPath.replace('.html', '.meta.json');
  
  // Read HTML and metadata
  let html = fs.readFileSync(htmlPath, 'utf-8');
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf-8')) : {};
  
  // Strip CSS to avoid parsing errors
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
  
  // Build image map from meta.json
  const imageMap = {};
  if (meta.images) {
    meta.images.forEach(img => {
      const wixMatch = img.original.match(/\/(c16946_[^?\/]+)/);
      if (wixMatch && img.local) {
        imageMap[wixMatch[1]] = img.local;
        const baseWixName = wixMatch[1].replace(/~mv2.*$/, '');
        imageMap[baseWixName] = img.local;
      }
    });
  }
  
  // Extract content and convert to markdown
  const contentDiv = doc.querySelector('[data-hook="post-description"]');
  let markdownContent = '';
  let description = '';
  
  if (contentDiv) {
    // Get the raw HTML content first for better processing
    let rawHTML = contentDiv.innerHTML;
    
    // Replace Wix image URLs with local paths in the raw HTML
    Object.entries(imageMap).forEach(([wixName, localPath]) => {
      const patterns = [
        new RegExp(`https://static\\.wixstatic\\.com/media/${wixName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"']*`, 'gi'),
        new RegExp(wixName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      ];
      patterns.forEach(pattern => {
        rawHTML = rawHTML.replace(pattern, `/images/${localPath}`);
      });
    });
    
    // Clean up content HTML before conversion
    const cleanDom = new JSDOM(rawHTML);
    const contentClone = cleanDom.window.document.body;
    
    // Remove Wix-specific elements but keep images
    contentClone.querySelectorAll('[data-hook]:not(img), button, figcaption, script, style').forEach(el => el.remove());
    
    // Remove social icons (small images) but keep content images
    contentClone.querySelectorAll('img').forEach(img => {
      const src = img.getAttribute('src') || '';
      const width = parseInt(img.getAttribute('width') || '999');
      const height = parseInt(img.getAttribute('height') || '999');
      
      // Remove social icons and placeholder images
      if (width < 50 || height < 50 || src.includes('puppet.png') || src.includes('linkedin') || src.includes('facebook')) {
        img.remove();
      } else {
        // Ensure local path format
        if (!src.startsWith('/images/')) {
          const filename = src.split('/').pop()?.split('?')[0];
          if (filename?.startsWith('blog-')) {
            img.setAttribute('src', `/images/${filename}`);
          }
        }
      }
    });
    
    markdownContent = htmlToMarkdown(contentClone.outerHTML, imageMap);
    
    // Extract description from first paragraph (cleaned text)
    const textContent = contentClone.textContent || '';
    const firstPara = textContent.trim().split('\n\n')[0];
    if (firstPara) {
      description = firstPara.substring(0, 150);
    }
  }
  
  if (!description && title) {
    description = title.substring(0, 150);
  }
  
  // Get featured image
  let featuredImagePath = '';
  const listingThumbnail = listingThumbnails[title];
  if (listingThumbnail) {
    featuredImagePath = `/images/${listingThumbnail}`;
  } else if (meta.images && meta.images.length > 0) {
    const contentImages = meta.images.filter(img => img.width > 50 && img.height > 50);
    if (contentImages[1]?.local) {
      featuredImagePath = `/images/${contentImages[1].local}`;
    } else if (contentImages[0]?.local) {
      featuredImagePath = `/images/${contentImages[0].local}`;
    }
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
