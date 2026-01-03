/**
 * Migration Script: Add TeamId to Analysis Records
 * 
 * This script connects to the database and:
 * 1. For each Analysis record without a teamId
 * 2. Looks up the corresponding Github_Repository by github_repositoryId
 * 3. Gets the teamId from the repository and updates the Analysis
 * 
 * Run with: npx tsx src/scripts/migrate-analysis-team-ids.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Import models
import Analysis from '../models/analysis.model.js';
import { Github_Repository } from '../models/github_repostries.model.js';

const MONGODB_URI = process.env.BEETLE_DB;

async function connectDB(): Promise<void> {
  if (!MONGODB_URI) {
    throw new Error('BEETLE_DB environment variable is not set');
  }
  await mongoose.connect(MONGODB_URI);
  console.log('✅ MongoDB connected');
}

async function migrateAnalysisTeamIds(): Promise<void> {
  console.log('🔄 Starting Analysis team ID migration...\n');

  // Get all analyses without teamId that have a github_repositoryId
  const analyses = await Analysis.find({
    $or: [
      { teamId: { $exists: false } },
      { teamId: null }
    ],
    github_repositoryId: { $exists: true, $ne: null }
  }).select('_id github_repositoryId userId').lean();

  console.log(`📊 Found ${analyses.length} analyses without teamId\n`);

  let updated = 0;
  let skipped = 0;
  let noRepoTeam = 0;
  let errors = 0;

  // Build a map of repository IDs to teamIds for efficiency
  const repoIds = [...new Set(analyses.map(a => String(a.github_repositoryId)))];
  console.log(`📦 Fetching ${repoIds.length} unique repositories...\n`);

  const repositories = await Github_Repository.find({
    _id: { $in: repoIds.map(id => new mongoose.Types.ObjectId(id)) }
  }).select('_id teamId').lean();

  const repoTeamMap = new Map<string, string>();
  for (const repo of repositories) {
    if (repo.teamId) {
      repoTeamMap.set(String(repo._id), repo.teamId);
    }
  }

  console.log(`🗺️  Found teamIds for ${repoTeamMap.size} repositories\n`);

  // Batch update analyses
  const bulkOps: any[] = [];

  for (const analysis of analyses) {
    const repoId = String(analysis.github_repositoryId);
    const teamId = repoTeamMap.get(repoId);

    if (teamId) {
      bulkOps.push({
        updateOne: {
          filter: { _id: analysis._id },
          update: { $set: { teamId } }
        }
      });
      updated++;
    } else {
      noRepoTeam++;
    }
  }

  // Execute bulk update
  if (bulkOps.length > 0) {
    console.log(`📝 Executing bulk update for ${bulkOps.length} analyses...`);
    const result = await Analysis.bulkWrite(bulkOps);
    console.log(`✅ Modified ${result.modifiedCount} analyses\n`);
  }

  console.log('='.repeat(50));
  console.log('📈 Migration Summary:');
  console.log(`   ✅ Analyses updated: ${updated}`);
  console.log(`   ⏭️  Skipped (repo has no teamId): ${noRepoTeam}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log('='.repeat(50));
}

async function main(): Promise<void> {
  try {
    await connectDB();
    await migrateAnalysisTeamIds();
    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 MongoDB disconnected');
  }
}

main();
