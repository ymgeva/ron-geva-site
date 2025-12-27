const { JSDOM } = require('jsdom');
const fs = require('fs');

// Read a simple blog HTML
const html = fs.readFileSync('raw-scraped/html/blog-clotting.html', 'utf8');
const dom = new JSDOM(html, { 
  pretendToBeVisual: false,
  resources: 'usable',
  runScripts: 'outside-only'
});
const doc = dom.window.document;

const contentDiv = doc.querySelector('[data-hook="post-description"]');
if (!contentDiv) { 
  console.log('No content div'); 
  process.exit(1); 
}

const allImages = Array.from(contentDiv.querySelectorAll('img'));
console.log('Total images:', allImages.length);

if (allImages.length > 1) {
  console.log('\nFirst two images:');
  for (let i = 0; i < Math.min(2, allImages.length); i++) {
    const img = allImages[i];
    console.log(`\nImage ${i + 1}:`);
    
    let container = img.parentElement;
    let depth = 0;
    while (container && container !== contentDiv && depth < 10) {
      console.log(`  Level ${depth}: ${container.tagName} children:${container.children.length}`);
      if (container.children.length === 1) {
        container = container.parentElement;
      } else {
        break;
      }
      depth++;
    }
    
    if (container && container.nextElementSibling) {
      const next = container.nextElementSibling;
      console.log(`  Next sibling: ${next.tagName}`);
      const nextImg = next.querySelector('img');
      console.log(`  Has image: ${!!nextImg}`);
    } else {
      console.log('  No next sibling or reached content div');
    }
  }
}
