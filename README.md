# Ron Geva Artist Website

Bilingual (Hebrew/English) portfolio website for Ron Geva, built with Astro and Decap CMS.

## Features

- 🌐 **Bilingual**: Full Hebrew (RTL) and English (LTR) support
- 🎨 **Art Galleries**: Organized by category (Color, Portraits, B&W, Sculptures, Postcards)
- 📝 **Blog**: Creative writing and reflections
- 📚 **Book Page**: Poetry book showcase with reviews and purchase links
- 💬 **Comments**: Giscus integration for blog discussions
- 🎛️ **CMS**: Zero-code content management via Decap CMS
- 🚀 **Performance**: Static site generation with Astro
- 📱 **Responsive**: Mobile-first design with Tailwind CSS

## Tech Stack

- **Framework**: [Astro](https://astro.build/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **CMS**: [Decap CMS](https://decapcms.org/) (formerly Netlify CMS)
- **Deployment**: [Netlify](https://netlify.com/)
- **Fonts**: Alef (Hebrew), Fahkwang (Headings)

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Content Management

Access the CMS at `/admin` after deploying to Netlify with Netlify Identity enabled.

### Content Structure

- **Artworks**: `/src/content/artworks/{lang}/` - Organized by category
- **Blog Posts**: `/src/content/blog/{lang}/` - Blog posts with full i18n
- **Pages**: `/src/content/pages/{lang}/` - Static pages (about, book, alligators)

### Adding Content

1. Navigate to `/admin` on your deployed site
2. Log in with Netlify Identity
3. Create or edit content through the CMS interface
4. All changes are committed to Git automatically

## Scraped Content

The original Wix content has been scraped and saved in `/scraped-content/`:
- Pages as JSON and Markdown
- All images downloaded
- Font information extracted

## License

All content © Ron Geva. All rights reserved.

