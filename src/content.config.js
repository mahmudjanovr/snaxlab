import { glob } from 'astro/loaders'
import { defineCollection, z } from 'astro:content'

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      date: z.coerce.date(),
      order: z.number().optional(),
      image: image().optional(),
      tags: z.array(z.string()).optional(),
      author: z.string().default('snaxcyz'),
      draft: z.boolean().optional(),
      lang: z.literal('uz').default('uz'),
      series: z.string().optional(),
      seriesOrder: z.number().optional(),
    }),
})

const authors = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/authors' }),
  schema: z.object({
    name: z.string(),
    pronouns: z.string().optional(),
    avatar: z.string().url().or(z.string().startsWith('/')),
    bio: z.string().optional(),
    mail: z.string().email().optional(),
    website: z.string().url().optional(),
    twitter: z.string().url().optional(),
    github: z.string().url().optional(),
    linkedin: z.string().url().optional(),
    discord: z.string().url().optional(),
  }),
})

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      description: z.string(),
      tags: z.array(z.string()),
      image: z.string().optional().or(image().optional()),
      link: z.string().url(),
      github: z.string().url().optional(),
      featured: z.boolean().optional().default(false),
      startDate: z.coerce.date().optional(),
      endDate: z.coerce.date().optional(),
    }),
})

const bookshelf = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/bookshelf' }),
  schema: z.object({
    title: z.string(),
    author: z.string(),
    status: z.enum(['read', 'reading', 'want-to-read']),
    cover: z.string().optional(),
    rating: z.number().min(1).max(5).optional(),
    genre: z.string(),
    dateRead: z.coerce.date().optional(),
    description: z.string(),
    featured: z.boolean().optional().default(false),
    keyIdeas: z.array(z.string()).optional().default([]),
    quotes: z
      .array(
        z.object({
          quote: z.string(),
          page: z.string().optional(),
        }),
      )
      .optional()
      .default([]),
    relatedPostSlug: z.string().optional(),
  }),
})

const notes = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/notes' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).optional().default([]),
    subject: z.string().optional(),
    relatedBook: z.string().optional(),
    relatedPost: z.string().optional(),
  }),
})

const series = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/series' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    order: z.number().optional().default(0),
    featured: z.boolean().optional().default(false),
    posts: z.array(z.string()),
  }),
})

const quotes = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/quotes' }),
  schema: z.object({
    quote: z.string(),
    author: z.string(),
    work: z.string(),
    year: z.string().optional(),
    commentary: z.string().optional(),
    tags: z.array(z.string()).optional().default([]),
  }),
})

export const collections = {
  blog,
  authors,
  projects,
  bookshelf,
  notes,
  series,
  quotes,
}
