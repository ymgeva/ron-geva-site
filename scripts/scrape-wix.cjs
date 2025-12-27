/**
 * Wix Content Scraper
 * Extracts all content, images, and fonts from rongogeva.com
 */

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const TurndownService = require('turndown');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://www.rongogeva.com';
const OUTPUT_DIR = path.join(__dirname, '../scraped-content');

// Ensure output directories exist
const dirs = [
  OUTPUT_DIR,
  path.join(OUTPUT_DIR, 'pages'),
  path.join(OUTPUT_DIR, 'images'),
  path.join(OUTPUT_DIR, 'images/art'),
  path.join(OUTPUT_DIR, 'images/blog'),
  path.join(OUTPUT_DIR, 'fonts'),
  path.join(OUTPUT_DIR, 'metadata')
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Initialize Turndown for HTML to Markdown
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});

// Pages to scrape
const PAGES = [
  { name: 'home', url: '/' },
  { name: 'about', url: '/about' },
  { name: 'book', url: '/book' },
  { name: 'alligators', url: '/alligators' },
  { name: 'art-color', url: '/art/color' },
  { name: 'art-portraits', url: '/portraits' },
  { name: 'art-bw', url: '/art/bw' },
  { name: 'art-sculptures', url: '/art/sculpture' },
  { name: 'art-postcards', url: '/art/postcards' },
  { name: 'blog', url: '/blogs' }
];

async function downloadImage(url, filename) {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const filepath = path.join(OUTPUT_DIR, 'images', filename);
    fs.writeFileSync(filepath, response.data);
    console.log(`  ✓ Downloaded: ${filename}`);
    return filename;
  } catch (error) {
    console.error(`  ✗ Failed to download ${url}:`, error.message);
    return null;
  }
}

async function extractFonts(page) {
  console.log('\n🔤 Extracting fonts...');
  
  // Get computed styles from various text elements
  const fontInfo = await page.evaluate(() => {
    const elements = [
      ...document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, a')
    ].slice(0, 20); // Sample first 20 elements
    
    const fonts = new Set();
    elements.forEach(el => {
      const style = window.getComputedStyle(el);
      fonts.add(style.fontFamily);
    });
    
    return {
      families: Array.from(fonts),
      elements: elements.slice(0, 5).map(el => ({
        tag: el.tagName,
        text: el.textContent.substring(0, 50),
        fontFamily: window.getComputedStyle(el).fontFamily,
        fontWeight: window.getComputedStyle(el).fontWeight,
        fontSize: window.getComputedStyle(el).fontSize
      }))
    };
  });
  
  // Get font file requests from network
  const fontRequests = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('.woff') || url.includes('.woff2') || url.includes('.ttf')) {
      fontRequests.push(url);
    }
  });
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'metadata/fonts.json'),
    JSON.stringify(fontInfo, null, 2)
  );
  
  console.log('  Font families found:', fontInfo.families);
  return fontInfo;
}

async function scrapePage(browser, pageInfo) {
  console.log(`\n📄 Scraping: ${pageInfo.name} (${pageInfo.url})`);
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  try {
    await page.goto(BASE_URL + pageInfo.url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Scroll to load lazy images
    await autoScroll(page);
    
    // Wait a bit for any final loads
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get page HTML
    const html = await page.content();
    const $ = cheerio.load(html);
    
    // Extract images
    const images = [];
    const imgElements = await page.$$eval('img', imgs =>
      imgs.map(img => ({
        src: img.src,
        alt: img.alt || '',
        width: img.naturalWidth,
        height: img.naturalHeight
      }))
    );
    
    console.log(`  Found ${imgElements.length} images`);
    
    for (let i = 0; i < imgElements.length; i++) {
      const img = imgElements[i];
      if (img.src && img.src.includes('static.wixstatic.com')) {
        const ext = img.src.includes('.jpg') || img.src.includes('.jpeg') ? 'jpg' : 
                    img.src.includes('.png') ? 'png' : 
                    img.src.includes('.webp') ? 'webp' : 'jpg';
        const filename = `${pageInfo.name}-${i + 1}.${ext}`;
        const downloaded = await downloadImage(img.src, filename);
        if (downloaded) {
          images.push({
            original: img.src,
            local: filename,
            alt: img.alt,
            width: img.width,
            height: img.height
          });
        }
      }
    }
    
    // Extract text content
    const bodyText = await page.evaluate(() => {
      // Remove scripts, styles, and nav
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll('script, style, nav, header, footer').forEach(el => el.remove());
      return clone.innerText;
    });
    
    // Convert main content to markdown
    const mainContent = $('main, article, [role="main"]').html() || $('body').html();
    let markdown = '';
    try {
      markdown = turndownService.turndown(mainContent || '');
    } catch (e) {
      markdown = bodyText;
    }
    
    // Save page data
    const pageData = {
      name: pageInfo.name,
      url: pageInfo.url,
      title: await page.title(),
      markdown: markdown,
      rawText: bodyText,
      images: images,
      scrapedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'pages', `${pageInfo.name}.json`),
      JSON.stringify(pageData, null, 2)
    );
    
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'pages', `${pageInfo.name}.md`),
      markdown
    );
    
    console.log(`  ✓ Saved: ${pageInfo.name}.json and ${pageInfo.name}.md`);
    
    await page.close();
    return pageData;
    
  } catch (error) {
    console.error(`  ✗ Error scraping ${pageInfo.name}:`, error.message);
    await page.close();
    return null;
  }
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
        
        // Check if we've stopped growing
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
  console.log(`  Scraping all ${uniquePosts.length} blog posts...`);
  for (const post of uniquePosts) {
    const slug = post.url.split('/post/')[1].replace(/[?#].*/, '');
    await scrapePage(browser, {
      name: `blog-${slug}`,
      url: `/post/${slug}`
    });
    await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
  }
}

async function main() {
  console.log('🚀 Starting Wix content scraper...\n');
  console.log(`Source: ${BASE_URL}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    // First page - extract fonts
    const firstPage = await browser.newPage();
    await firstPage.goto(BASE_URL, { waitUntil: 'networkidle2' });
    await extractFonts(firstPage);
    await firstPage.close();
    
    // Scrape all main pages
    for (const pageInfo of PAGES) {
      await scrapePage(browser, pageInfo);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
    }
    
    // Scrape blog posts
    await scrapeBlogPosts(browser);
    
    console.log('\n✅ Scraping complete!');
    console.log(`\nContent saved to: ${OUTPUT_DIR}`);
    
  } catch (error) {
    console.error('\n❌ Scraping failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the scraper
main().catch(console.error);
