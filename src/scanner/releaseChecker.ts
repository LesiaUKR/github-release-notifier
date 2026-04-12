import { eq } from 'drizzle-orm';

import { config } from '../config';
import { db } from '../db';
import { repositories } from '../db/schema';
import { NotFoundError, RateLimitError } from '../errors';
import { sendReleaseNotifications } from '../notifier';
import * as cacheService from '../services/cacheService';
import * as repositoryService from '../services/repositoryService';
import * as subscriptionService from '../services/subscriptionService';
import { logger } from '../utils/logger';
import { scannerNewReleasesFound } from '../utils/metrics';
import * as githubClient from './githubClient';

const RATE_LIMIT_THRESHOLD = 5;
const DELAY_BETWEEN_REPOS_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRateLimited(): boolean {
  const { remaining } = githubClient.getRateLimitState();

  if (remaining !== null && remaining < RATE_LIMIT_THRESHOLD) {
    logger.warn(`GitHub rate limit low: ${remaining} requests remaining`);
    return true;
  }

  return false;
}

async function updateRepository(id: string, lastSeenTag: string): Promise<void> {
  await db
    .update(repositories)
    .set({ lastSeenTag, lastCheckedAt: new Date() })
    .where(eq(repositories.id, id));
}

async function markRepositoryChecked(id: string): Promise<void> {
  await db.update(repositories).set({ lastCheckedAt: new Date() }).where(eq(repositories.id, id));
}

export async function checkAllRepositories(): Promise<void> {
  const repos = await repositoryService.getAllTracked();

  if (repos.length === 0) {
    logger.debug('Scanner: no repositories to check');
    return;
  }

  logger.info(`Scanner: checking ${repos.length} repositories`);

  for (const repo of repos) {
    if (isRateLimited()) {
      logger.warn('Scanner: stopping cycle due to rate limit');
      break;
    }

    try {
      const subscribers = await subscriptionService.getByOwnerRepo(repo.owner, repo.repo);

      if (subscribers.length === 0) {
        logger.debug(`Scanner: skipping ${repo.owner}/${repo.repo}, no active subscribers`);
        continue;
      }

      const cacheKey = `github:release:${repo.owner}/${repo.repo}`;
      const cacheTtl = Math.floor(config.SCAN_INTERVAL_MS / 1000);

      let release = await cacheService.get<githubClient.GitHubRelease>(cacheKey);

      if (!release) {
        release = await githubClient.getLatestRelease(repo.owner, repo.repo);
        await cacheService.set(cacheKey, release, cacheTtl);
      }

      if (repo.lastSeenTag === null) {
        logger.info(
          `Scanner: first check for ${repo.owner}/${repo.repo}, storing tag ${release.tag_name}`
        );
        await updateRepository(repo.id, release.tag_name);
      } else if (release.tag_name !== repo.lastSeenTag) {
        logger.info(
          `Scanner: new release ${release.tag_name} for ${repo.owner}/${repo.repo} (was ${repo.lastSeenTag})`
        );
        scannerNewReleasesFound.inc();

        logger.info(
          `Scanner: ${subscribers.length} subscribers to notify for ${repo.owner}/${repo.repo}`
        );

        const notificationResult = await sendReleaseNotifications(subscribers, {
          owner: repo.owner,
          repo: repo.repo,
          tagName: release.tag_name,
          releaseName: release.name,
          htmlUrl: release.html_url,
          body: release.body,
        });

        if (notificationResult.failed > 0) {
          logger.warn(
            `Scanner: ${notificationResult.failed}/${notificationResult.total} emails failed for ${repo.owner}/${repo.repo}; keeping last_seen_tag at ${repo.lastSeenTag}`
          );
          await markRepositoryChecked(repo.id);
          continue;
        }

        await updateRepository(repo.id, release.tag_name);
      } else {
        logger.debug(
          `Scanner: no new release for ${repo.owner}/${repo.repo} (${release.tag_name})`
        );
        await markRepositoryChecked(repo.id);
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        logger.debug(`Scanner: no releases yet for ${repo.owner}/${repo.repo}`);
        continue;
      }

      if (error instanceof RateLimitError) {
        logger.warn(`Scanner: rate limit hit for ${repo.owner}/${repo.repo}, stopping cycle`);
        break;
      }

      logger.error(`Scanner: error checking ${repo.owner}/${repo.repo}:`, error);
    }

    await sleep(DELAY_BETWEEN_REPOS_MS);
  }
}
