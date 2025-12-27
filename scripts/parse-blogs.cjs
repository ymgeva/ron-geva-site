const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const RAW_HTML_DIR = path.join(__dirname, '../raw-scraped/html');
const OUTPUT_DIR = path.join(__dirname, '../src/content/blog/he');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Load blog listing thumbnails
const listingMetaPath = path.join(RAW_HTML_DIR, 'blog-listing.meta.json');
const listingThumbnails = {};
if (fs.existsSync(listingMetaPath)) {
  const listingMeta = JSON.parse(fs.readFileSync(listingMetaPath, 'utf-8'));
  listingMeta.images
    .filter(img => img.width > 50 && img.alt) // Filter out social icons and empty alts
    .forEach(img => {
      // Map by blog title
      listingThumbnails[img.alt.trim()] = img.local;
    });
}

// Get all blog HTML files
const files = fs.readdirSync(RAW_HTML_DIR)
  .filter(f => f.startsWith('blog-') && f.endsWith('.html') && f !== 'blog-listing.html');

console.log(`Found ${files.length} blog posts to parse`);

files.forEach(file => {
  const htmlPath = path.join(RAW_HTML_DIR, file);
  const metaPath = htmlPath.replace('.html', '.meta.json');
  
  // Read HTML and metadata
  let html = fs.readFileSync(htmlPath, 'utf-8');
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf-8')) : {};
  
  // Strip CSS to avoid parsing errors with Wix's complex CSS
  html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  html = html.replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, '');
  
  // Parse with JSDOM
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  
  // Extract title
  const titleEl = doc.querySelector('[data-hook="post-title"]');
  const title = titleEl ? titleEl.textContent.trim() : file.replace('blog-', '').replace('.html', '');
  
  // Generate clean slug from filename (without blog- prefix and .html extension)
  const slug = file.replace('blog-', '').replace('.html', '');
  
  // Extract date
  const dateEl = doc.querySelector('[data-hook="time-ago"]');
  let pubDate = new Date().toISOString().split('T')[0];
  if (dateEl) {
    const dateText = dateEl.textContent || dateEl.getAttribute('title') || '';
    // Parse Hebrew date format: "22 בפבר׳ 2024" or "3 במאי 2024"
    // \u05d1 is ב, then capture Hebrew month name
    const match = dateText.match(/(\d+)\s+\u05d1([\u05d0-\u05ea]+).*?(\d{4})/);
    if (match) {
      const day = match[1];
      const year = match[3];
      const monthMap = {
        '\u05d9\u05e0\u05d5': '01', '\u05e4\u05d1\u05e8': '02', '\u05de\u05e8\u05e5': '03', '\u05d0\u05e4\u05e8': '04',
        '\u05de\u05d0\u05d9': '05', '\u05d9\u05d5\u05e0': '06', '\u05d9\u05d5\u05dc': '07', '\u05d0\u05d5\u05d2': '08',
        '\u05e1\u05e4\u05d8': '09', '\u05d0\u05d5\u05e7': '10', '\u05e0\u05d5\u05d1': '11', '\u05d3\u05e6\u05de': '12'
      };
      const monthKey = match[2].substring(0, 3);
      const month = monthMap[monthKey] || '01';
      pubDate = `${year}-${month}-${day.padStart(2, '0')}`;
    }
  }
  
  // Extract author
  const authorEl = doc.querySelector('[data-hook="user-name"]');
  const author = authorEl ? authorEl.textContent.trim() : 'Ron Geva';
  
  // Extract reading time
  const readingTimeEl = doc.querySelector('[data-hook="time-to-read"]');
  const readingTime = readingTimeEl ? readingTimeEl.textContent.trim() : '';
  
  // Extract counters (views, comments, likes) - look for the pattern in HTML
  let views = 0, comments = 0, likes = 0;
  
  // Try to find view counter
  const viewsMatch = html.match(/(\d+)\s*צפיות/);
  if (viewsMatch) views = parseInt(viewsMatch[1]);
  
  // Try to find comments counter
  const commentsMatch = html.match(/(\d+)\s*תגובות/);
  if (commentsMatch) comments = parseInt(commentsMatch[1]);
  
  // Extract content paragraphs
  const contentDiv = doc.querySelector('[data-hook="post-description"]');
  const contentBlocks = [];
  
  if (contentDiv) {
    // Get all paragraph elements
    const paragraphs = contentDiv.querySelectorAll('p[dir="auto"]');
    let currentTextBlock = [];
    
    paragraphs.forEach(p => {
      const text = p.textContent.trim();
      if (text) {
        currentTextBlock.push(text);
      }
    });
    
    if (currentTextBlock.length > 0) {
      contentBlocks.push({
        type: 'text',
        content: currentTextBlock.join('\n\n')
      });
    }
  }
  
  // Extract images from gallery
  const galleryImages = [];
  const imageElements = doc.querySelectorAll('[data-hook="gallery-item-image-img"]');
  
  imageElements.forEach(img => {
    const src = img.getAttribute('src');
    if (src && !src.includes('puppet.png')) { // Skip logo
      galleryImages.push(src);
    }
  });
  
  // Filter out social media icons (typically 25x25px)
  const contentImages = meta.images ? meta.images.filter(img => 
    img.width > 50 && img.height > 50 && !img.alt.match(/linkedin|whatsapp|instagram|facebook/i)
  ) : [];
  
  // Determine grid layout
  let imageGridLayout = 'single';
  if (contentImages.length === 2) imageGridLayout = '2-col';
  else if (contentImages.length === 3) imageGridLayout = '3-col';
  else if (contentImages.length === 4) imageGridLayout = '2x2';
  else if (contentImages.length === 6) imageGridLayout = '3x2';
  else if (contentImages.length > 6) imageGridLayout = '3-col';
  
  // Helper to escape YAML strings
  const escapeYaml = (str) => {
    if (!str) return '';
    return str.replace(/"/g, '\\"').replace(/\n/g, ' ');
  };
  
  // Extract full HTML content from post description
  let htmlContent = '';
  if (contentDiv) {
    // Clone the content div to manipulate it
    const contentClone = contentDiv.cloneNode(true);
    const cloneDoc = contentClone.ownerDocument;
    
    // Simple approach: find all images and check if next siblings are also images
    const allImages = Array.from(contentClone.querySelectorAll('img'));
    const processedImages = new Set();
    const imageGroups = [];
    
    allImages.forEach(img => {
      if (processedImages.has(img)) return;
      
      const group = [img];
      processedImages.add(img);
      
      // Get the container of this image (could be nested in divs)
      let container = img.parentElement;
      while (container && container !== contentClone && container.children.length === 1) {
        container = container.parentElement;
      }
      
      // Look for sequential sibling containers with images
      if (container && container.parentElement) {
        let nextSibling = container.nextElementSibling;
        
        while (nextSibling) {
          const nextImg = nextSibling.querySelector('img');
          if (nextImg && !processedImages.has(nextImg)) {
            group.push(nextImg);
            processedImages.add(nextImg);
            nextSibling = nextSibling.nextElementSibling;
          } else {
            break;
          }
        }
      }
      
      // Only group if we have 2+ images
      if (group.length > 1) {
        imageGroups.push(group);
      }
    });
    
    // Wrap each image group in a grid div
    imageGroups.forEach(group => {
      const gridClass = group.length === 2 ? 'grid-2-col' : 
                       group.length === 3 ? 'grid-3-col' :
                       group.length === 4 ? 'grid-2x2' :
                       group.length === 6 ? 'grid-3x2' : 'grid-3-col';
      
      // Create wrapper div
      const wrapper = cloneDoc.createElement('div');
      wrapper.className = `image-grid ${gridClass}`;
      
      // Find a common parent and insert wrapper
      const firstImg = group[0];
      let firstContainer = firstImg.parentElement;
      while (firstContainer && firstContainer !== contentClone && firstContainer.children.length === 1) {
        firstContainer = firstContainer.parentElement;
      }
      
      if (firstContainer && firstContainer.parentElement) {
        firstContainer.parentElement.insertBefore(wrapper, firstContainer);
        
        // Move all images to wrapper and remove their containers
        group.forEach(img => {
          let imgContainer = img.parentElement;
          while (imgContainer && imgContainer !== contentClone && imgContainer.children.length === 1) {
            imgContainer = imgContainer.parentElement;
          }
          
          wrapper.appendChild(img);
          
          // Remove the now-empty container
          if (imgContainer && imgContainer.parentElement && imgContainer !== contentClone) {
            imgContainer.parentElement.removeChild(imgContainer);
          }
        });
      }
    });
    
    // Build image map from meta.json for replacing Wix filenames
    const imageMap = {};
    if (meta.images) {
      meta.images.forEach(img => {
        // Extract Wix filename from URL (e.g., c16946_xxx~mv2.jpg)
        const wixMatch = img.original.match(/\/(c16946_[^?\/]+)/);
        if (wixMatch && img.local) {
          imageMap[wixMatch[1]] = img.local;
          // Also map base name without extension
          const baseWixName = wixMatch[1].replace(/~mv2.*$/, '');
          imageMap[baseWixName] = img.local;
        }
      });
    }
    
    htmlContent = contentClone.innerHTML
      // Fix image paths to use /images/ prefix
      .replace(/src="([^"]*\/)?([^\/"]+\.(jpg|jpeg|png|gif|webp))"/gi, (match, path, filename) => {
        // Check if it's a Wix c16946 filename
        if (filename.includes('c16946_')) {
          // Try to find mapping in meta.json
          const baseName = filename.replace(/~mv2.*$/, '').split('.')[0];
          const localFile = imageMap[filename] || imageMap[baseName + '.jpg'] || imageMap[baseName + '.webp'] || imageMap[baseName + '.png'];
          if (localFile) {
            return `src="/images/${localFile}"`;
          }
        }
        // Already has blog- prefix
        if (filename.startsWith('blog-')) {
          return `src="/images/${filename}"`;
        }
        return match;
      })
      // Remove Wix-specific attributes
      .replace(/data-hook="[^"]*"/g, '')
      .replace(/data-image-info="[^"]*"/g, '')
      .replace(/data-[a-z-]+="[^"]*"/g, '')
      .replace(/class="[^"]*"/g, (match) => {
        // Keep only our grid classes
        if (match.includes('image-grid') || match.includes('grid-')) {
          return match.replace(/class="([^"]*?(image-grid|grid-[^"]*)).*?"/, 'class="$1"');
        }
        return '';
      })
      // Clean up inline styles
      .replace(/style="[^"]*"/g, '')
      .replace(/id="[^"]*"/g, '')
      // Remove empty attributes
      .replace(/\s+>/g, '>')
      .replace(/<p\s+>/g, '<p>')
      .replace(/<div\s+>/g, '<div>')
      // Remove wow-image tags but keep img
      .replace(/<wow-image[^>]*>/g, '')
      .replace(/<\/wow-image>/g, '')
      // Remove figure/figcaption wrappers
      .replace(/<figure[^>]*>/g, '')
      .replace(/<\/figure>/g, '')
      .replace(/<figcaption[^>]*>.*?<\/figcaption>/gs, '')
      // Remove button overlays
      .replace(/<button[^>]*>.*?<\/button>/gs, '')
      // Clean up excessive nesting
      .replace(/<div>\s*<div>/g, '<div>')
      .replace(/<\/div>\s*<\/div>/g, '</div>')
      // Clean up whitespace
      .trim();
    
    // Escape for YAML
    htmlContent = htmlContent
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n');
  }

  // Get featured image: prioritize listing thumbnail, fallback to second content image (first is usually header)
  let featuredImagePath = '';
  const listingThumbnail = listingThumbnails[title];
  if (listingThumbnail) {
    featuredImagePath = `/images/${listingThumbnail}`;
  } else if (contentImages[1]?.local) {
    // Use second image as fallback (first is usually the header/banner)
    featuredImagePath = `/images/${contentImages[1].local}`;
  } else if (contentImages[0]?.local) {
    // If only one image, use it
    featuredImagePath = `/images/${contentImages[0].local}`;
  }
  
  // Build markdown content with HTML
  let markdown = `---
title: "${escapeYaml(title)}"
pubDate: ${pubDate}
author: "${escapeYaml(author)}"
readingTime: "${escapeYaml(readingTime)}"
description: "${escapeYaml(contentBlocks[0]?.content.substring(0, 150) || title)}..."
featuredImage: "${featuredImagePath}"
htmlContent: "${htmlContent}"
views: ${views}
comments: ${comments}
likes: ${likes}
imageLayout: "${imageGridLayout}"
draft: false
---

<!-- Content rendered from htmlContent frontmatter -->
`;

  // Write markdown file
  const outputPath = path.join(OUTPUT_DIR, `${file.replace('blog-', '').replace('.html', '')}.md`);
  fs.writeFileSync(outputPath, markdown);
  
  console.log(`✓ Parsed: ${title}`);
});

console.log(`\n✅ Successfully parsed ${files.length} blog posts to ${OUTPUT_DIR}`);
