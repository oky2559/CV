import { z } from 'zod';

export const LANGS = ['fr', 'en'] as const;
export type Lang = (typeof LANGS)[number];

const text = z.object({
  fr: z.string().min(1, 'texte FR vide'),
  en: z.string().min(1, 'texte EN vide'),
});

const date = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'format attendu : AAAA-MM');
const url = z.string().url();

export const cvSchema = z.object({
  identity: z.object({
    name: z.string().min(1),
    title: text,
    tagline: text,
    location: text,
    photo: z.string().optional(),
  }),
  bio: text,
  experiences: z.array(
    z.object({
      role: text,
      company: z.string().min(1),
      start: date,
      end: date.nullable(), // null = poste actuel
      description: text,
      tech: z.array(z.string()).default([]),
    }),
  ),
  education: z.array(
    z.object({
      degree: text,
      school: z.string().min(1),
      start: date,
      end: date.nullable(),
      description: text.optional(),
    }),
  ),
  projects: z.array(
    z.object({
      title: text,
      description: text,
      stack: z.array(z.string()).default([]),
      github: url.optional(),
      demo: url.optional(),
    }),
  ),
  skills: z.array(
    z.object({
      category: text,
      items: z.array(z.string().min(1)).min(1),
    }),
  ),
  languages: z.array(z.object({ name: text, level: text })),
  links: z.object({
    email: z.string().email(),
    github: url,
    linkedin: url,
    githubUser: z.string().min(1),
  }),
});

export type CVData = z.infer<typeof cvSchema>;
