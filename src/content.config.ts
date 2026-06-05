import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const reviewStatus = z.enum(['draft', 'needs-review', 'reviewed']);

const resources = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/resources' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    url: z.string().url(),
    language: z.enum(['ja', 'en', 'zh-Hans', 'zh-Hant', 'ko', 'other']),
    region: z.string().default('global'),
    category: z.enum(['medical', 'legal', 'community', 'research', 'guide', 'directory', 'media']),
    tags: z.array(z.string()).default([]),
    // Controlled-vocabulary tags (src/data/tag-taxonomy.ts) for the site-wide
    // /tags/ system; the free-form `tags` above stay for search.
    topicTags: z.array(z.string()).default([]),
    reviewStatus: reviewStatus.default('needs-review'),
    updatedAt: z.coerce.date(),
  }),
});

const glossary = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/glossary' }),
  schema: z.object({
    term: z.string(),
    reading: z.string().optional(),
    aliases: z.array(z.string()).default([]),
    language: z.enum(['ja', 'en']).default('ja'),
    tags: z.array(z.string()).default([]),
    updatedAt: z.coerce.date(),
  }),
});

const regions = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/regions' }),
  schema: z.object({
    name: z.string(),
    prefectureCode: z.string(),
    description: z.string(),
    reviewStatus: reviewStatus.default('draft'),
    updatedAt: z.coerce.date(),
  }),
});

const imported = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/imported' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    sourceProject: z.string(),
    sourcePath: z.string(),
    sourceLicense: z.string(),
    sourceCategory: z.string(),
    importedAt: z.coerce.date(),
    reviewStatus: reviewStatus.default('needs-review'),
  }),
});

export const collections = { resources, glossary, regions, imported };
