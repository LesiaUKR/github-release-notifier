import { and, eq } from 'drizzle-orm';

import { db } from '../db';
import { repositories } from '../db/schema';
import * as githubClient from '../scanner/githubClient';
import * as cacheService from './cacheService';

const CACHE_TTL = 600; // 10 minutes

export async function validateAndUpsert(owner: string, repo: string) {
  const cacheKey = `github:repo:${owner}/${repo}`;

  let repoData = await cacheService.get<githubClient.GitHubRepo>(cacheKey);

  if (!repoData) {
    repoData = await githubClient.getRepository(owner, repo);
    await cacheService.set(cacheKey, repoData, CACHE_TTL);
  }

  const [repository] = await db
    .insert(repositories)
    .values({ owner, repo })
    .onConflictDoUpdate({
      target: [repositories.owner, repositories.repo],
      set: { lastCheckedAt: new Date() },
    })
    .returning();

  return repository;
}

export async function findByOwnerRepo(owner: string, repo: string) {
  const [repository] = await db
    .select()
    .from(repositories)
    .where(and(eq(repositories.owner, owner), eq(repositories.repo, repo)));

  return repository ?? null;
}

export async function getAllTracked() {
  return db.select().from(repositories);
}
