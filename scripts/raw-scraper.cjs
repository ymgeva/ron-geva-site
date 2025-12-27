const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const BASE_URL = 'https://www.rongogeva.com';
const OUTPUT_DIR = path.join(__dirname, '../raw-scraped');

// Create output directories
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
if (!fs.existsSync(path.join(OUTPUT_DIR, 'html'))) {
  fs.mkdirSync(path.join(OUTPUT_DIR, 'html'), { recursive: true });
}
if (!fs.existsSync(path.join(OUTPUT_DIR, 'images'))) {
  fs.mkdirSync(path.join(OUTPUT_DIR, 'images'), { recursive: true });
}

async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(filepath);
    
    protocol.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(filepath);
        });
      } else {
        fs.unlink(filepath, () => {});
        reject(new Error(`Failed to download: ${response.statusCode}`));
      }
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      let lastHeight = 0;
      let sameHeightCount = 0;
      
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        
        if (scrollHeight === lastHeight) {
          sameHeightCount++;
          if (sameHeightCount >= 5) {
            clearInterval(timer);
            resolve();
          }
        } else {
          sameHeightCount = 0;
          lastHeight = scrollHeight;
        }

        if (totalHeight >= scrollHeight + 2000) {
          clearInterval(timer);
          resolve();
        }
      }, 200);
    });
  });
}

async function scrapePage(browser, url, filename) {
  console.log(`\n📄 Scraping: ${url}`);
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  try {
    await page.goto(BASE_URL + url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    // Scroll to load all content
    await autoScroll(page);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get all image URLs (including those in links)
    const imageData = await page.evaluate(() => {
      const images = [];
      const seen = new Set();
      
      // Get all img tags
      document.querySelectorAll('img').forEach(img => {
        let src = img.src;
        if (src && src.includes('static.wixstatic.com') && !seen.has(src)) {
          // Check if image is wrapped in a link
          let link = null;
          let parent = img.parentElement;
          if (parent && parent.tagName === 'A') {
            link = parent.href;
          }
          
          images.push({
            src: src,
            alt: img.alt || '',
            link: link,
            width: img.naturalWidth,
            height: img.naturalHeight
          });
          seen.add(src);
        }
      });
      
      return images;
    });
    
    console.log(`  Found ${imageData.length} images`);
    
    // Download all images
    const imageMap = {};
    for (let i = 0; i < imageData.length; i++) {
      const img = imageData[i];
      const ext = img.src.includes('.jpg') || img.src.includes('.jpeg') ? 'jpg' : 
                  img.src.includes('.png') ? 'png' : 
                  img.src.includes('.webp') ? 'webp' : 'jpg';
      const localFilename = `${filename}-${i + 1}.${ext}`;
      const filepath = path.join(OUTPUT_DIR, 'images', localFilename);
      
      try {
        await downloadImage(img.src, filepath);
        console.log(`  ✓ Downloaded: ${localFilename}`);
        imageMap[img.src] = localFilename;
      } catch (err) {
        console.log(`  ✗ Failed to download image: ${err.message}`);
      }
    }
    
    // Get the raw HTML
    const html = await page.content();
    
    // Save raw HTML
    const htmlPath = path.join(OUTPUT_DIR, 'html', `${filename}.html`);
    fs.writeFileSync(htmlPath, html);
    
    // Save image mapping
    const metaPath = path.join(OUTPUT_DIR, 'html', `${filename}.meta.json`);
    fs.writeFileSync(metaPath, JSON.stringify({
      url: url,
      filename: filename,
      imageCount: imageData.length,
      images: imageData.map((img, i) => ({
        original: img.src,
        local: imageMap[img.src] || null,
        alt: img.alt,
        link: img.link,
        width: img.width,
        height: img.height
      })),
      scrapedAt: new Date().toISOString()
    }, null, 2));
    
    console.log(`  ✓ Saved: ${filename}.html and ${filename}.meta.json`);
    
    await page.close();
    return imageData.length;
    
  } catch (error) {
    console.error(`  ✗ Error scraping ${url}:`, error.message);
    await page.close();
    return 0;
  }
}

async function scrapeBlogPosts(browser) {
  console.log('\n📝 Discovering blog posts...');
  
  const page = await browser.newPage();
  await page.goto(BASE_URL + '/blogs', { waitUntil: 'networkidle2', timeout: 60000 });
  
  // Scroll multiple times to trigger infinite scroll
  for (let i = 0; i < 3; i++) {
    await autoScroll(page);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Extract blog post links
  const postLinks = await page.$$eval('a[href*="/post/"]', links =>
    links.map(link => ({
      url: link.href,
      text: link.textContent.trim()
    }))
  );
  
  // Get unique post URLs
  const uniquePosts = [...new Map(postLinks.map(p => [p.url, p])).values()];
  console.log(`  Found ${uniquePosts.length} blog posts`);
  
  await page.close();
  
  // Scrape each blog post
  for (const post of uniquePosts) {
    const slug = post.url.split('/post/')[1].replace(/[?#].*/, '');
    await scrapePage(browser, `/post/${slug}`, `blog-${slug}`);
    await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
  }
  
  return uniquePosts.length;
}

async function main() {
  console.log('🚀 Starting RAW content scraper...\n');
  console.log(`Source: ${BASE_URL}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    // Define pages to scrape
    const pages = [
      { url: '/', filename: 'home' },
      { url: '/about', filename: 'about' },
      { url: '/book', filename: 'book' },
      { url: '/alligators', filename: 'alligators' },
      { url: '/art/color', filename: 'art-color' },
      { url: '/portraits', filename: 'art-portraits' },
      { url: '/art/bw', filename: 'art-bw' },
      { url: '/art/sculpture', filename: 'art-sculptures' },
      { url: '/art/postcards', filename: 'art-postcards' },
      { url: '/blogs', filename: 'blog-listing' }
    ];
    
    // Scrape main pages
    for (const pageInfo of pages) {
      await scrapePage(browser, pageInfo.url, pageInfo.filename);
    }
    
    // Scrape all blog posts
    const blogCount = await scrapeBlogPosts(browser);
    
    console.log('\n✨ Raw scraping complete!');
    console.log(`\nScraped ${pages.length} main pages and ${blogCount} blog posts`);
    
  } catch (error) {
    console.error('❌ Error during scraping:', error);
  } finally {
    await browser.close();
  }
}

main();
