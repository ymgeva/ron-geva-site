const fs = require('fs');
const path = require('path');
const https = require('https');

// Mapping of old category names to new ones
const CATEGORIES = {
  'art-color': 'color',
  'art-bw': 'bw',
  'art-sculptures': 'sculptures',
  'art-portraits': 'portraits',
  'art-postcards': 'postcards'
};

const WIXSITE_URLS = {
  'color': 'https://www.rongogeva.com/art/color',
  'bw': 'https://www.rongogeva.com/art/bw',
  'sculptures': 'https://www.rongogeva.com/art/sculpture',
  'portraits': 'https://www.rongogeva.com/art/portraits',
  'postcards': 'https://www.rongogeva.com/art/postcards'
};

const OUTPUT_BASE = path.join(__dirname, '..', 'public', 'images', 'art');

// Ensure output directories exist
Object.values(CATEGORIES).forEach(cat => {
  const dir = path.join(OUTPUT_BASE, cat);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Download image from URL
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

// Fetch HTML and extract Wix image URLs
function fetchWixImages(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      let html = '';
      response.on('data', chunk => html += chunk);
      response.on('end', () => {
        // Extract all Wix static image URLs
        const imageRegex = /https:\/\/static\.wixstatic\.com\/media\/([^"'\s]+\.(jpg|png|jpeg))/gi;
        const matches = [...html.matchAll(imageRegex)];
        
        // Get unique base image IDs (remove size parameters)
        const imageIds = new Set();
        matches.forEach(match => {
          const fullUrl = match[0];
          // Extract the base image ID before /v1/
          const baseMatch = fullUrl.match(/\/media\/([^/]+\.(jpg|png|jpeg))/i);
          if (baseMatch) {
            imageIds.add(baseMatch[1]);
          }
        });
        
        resolve([...imageIds]);
      });
    }).on('error', reject);
  });
}

async function downloadCategoryImages(category, wixUrl) {
  console.log(`\n=== Processing ${category} ===`);
  console.log(`Fetching images from ${wixUrl}...`);
  
  try {
    const imageIds = await fetchWixImages(wixUrl);
    console.log(`Found ${imageIds.length} unique images`);
    
    let downloaded = 0;
    for (let i = 0; i < imageIds.length; i++) {
      const imageId = imageIds[i];
      const ext = path.extname(imageId);
      const outputPath = path.join(OUTPUT_BASE, category, `${i + 1}${ext}`);
      
      // Skip if already exists
      if (fs.existsSync(outputPath)) {
        console.log(`  [${i + 1}/${imageIds.length}] Already exists: ${path.basename(outputPath)}`);
        continue;
      }
      
      const originalUrl = `https://static.wixstatic.com/media/${imageId}`;
      
      try {
        await downloadImage(originalUrl, outputPath);
        downloaded++;
        console.log(`  [${i + 1}/${imageIds.length}] Downloaded: ${path.basename(outputPath)}`);
      } catch (err) {
        console.error(`  [${i + 1}/${imageIds.length}] Failed: ${err.message}`);
      }
      
      // Rate limiting - wait 200ms between downloads
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`✓ ${category}: Downloaded ${downloaded} new images (${imageIds.length} total)`);
    return imageIds.length;
  } catch (err) {
    console.error(`✗ ${category}: ${err.message}`);
    return 0;
  }
}

async function main() {
  console.log('Starting full-resolution image download from Wix...');
  console.log(`Output directory: ${OUTPUT_BASE}\n`);
  
  const results = {};
  
  for (const [category, wixUrl] of Object.entries(WIXSITE_URLS)) {
    results[category] = await downloadCategoryImages(category, wixUrl);
  }
  
  console.log('\n=== Summary ===');
  Object.entries(results).forEach(([cat, count]) => {
    console.log(`${cat}: ${count} images`);
  });
  console.log('\nDone!');
}

main().catch(console.error);
