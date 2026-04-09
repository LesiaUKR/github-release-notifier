import {
  boolean,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// ── subscriptions ──────────────────────────────────────────────
// WHO wants notifications about WHAT
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    owner: varchar('owner', { length: 255 }).notNull(),
    repo: varchar('repo', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('subscriptions_email_owner_repo_idx').on(table.email, table.owner, table.repo),
    index('subscriptions_owner_repo_idx').on(table.owner, table.repo),
  ]
);

// ── repositories ───────────────────────────────────────────────
// Scanner state: last known release per repo
export const repositories = pgTable(
  'repositories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    owner: varchar('owner', { length: 255 }).notNull(),
    repo: varchar('repo', { length: 255 }).notNull(),
    lastSeenTag: varchar('last_seen_tag', { length: 255 }),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [uniqueIndex('repositories_owner_repo_idx').on(table.owner, table.repo)]
);

// ── api_keys ───────────────────────────────────────────────────
// API key auth: stores SHA-256 hash of the key, never plaintext
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  keyHash: varchar('key_hash', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
