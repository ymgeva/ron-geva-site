import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    slug: z.string().optional(),
    pubDate: z.coerce.date(),
    author: z.string(),
    readingTime: z.string(),
    description: z.string(),
    featuredImage: z.string(),
    htmlContent: z.string().optional(), // Store raw HTML content
    views: z.number().default(0),
    comments: z.number().default(0),
    likes: z.number().default(0),
    imageLayout: z.enum(['single', '2-col', '3-col', '2x2', '3x2', 'other']).default('other'),
    draft: z.boolean().default(false),
  }),
});

const artworks = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    category: z.enum(['color', 'bw', 'sculptures', 'portraits', 'postcards']),
    year: z.number().optional(),
    medium: z.string().optional(),
    dimensions: z.string().optional(),
    featuredImage: z.string().optional(),
    images: z.array(z.string()).optional(),
  }),
});

const artCategories = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    image: z.string(),
    count: z.number(),
    order: z.number().default(0),
    description: z.string().optional(),
  }),
});

export const collections = { blog, artworks, 'art-categories': artCategories };
