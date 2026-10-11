// src/models/index.js
const { createSequelize } = require('../config/database');
const logger = require('../config/logger');
const config = require('../config/env');

const sequelize = createSequelize();

// Load model definers
const modelDefiners = [
  // K-12 education structure (learnda-dev-guide.md §2, §4)
  require('./LearningUnit'),
  require('./LearningPathway'),
  require('./PathwaySubjectRule'),
  require('./User'),
  require('./UserContact'),
  require('./RegistrationSession'),
  require('./AcademicProfile'),
  require('./AuthSession'),
  require('./RegistrationSecurityEvent'),
  require('./Progress'),
  require('./Lesson'),
  require('./VideoLesson'),
  require('./TextItem'),
  require('./ContentMetadata'),
  require('./ContentStats'),
  require('./Course'),
  require('./PastQuestionMode'),
  require('./Contribution'),
  require('./Plan'),
  require('./PlanFeature'),
  require('./Subscription'),
  require('./PLSItem'),
  require('./PLSFolder'),
  require('./PLSFolderItem'),
  require('./Comment'),
  require('./ContentEngagement'),
  require('./Badge'),
  require('./UserBadge'),
  require('./Leaderboard'),
  require('./LeaderboardEntry'),
  require('./Event'),
  require('./NewsletterSubscription'),
  require('./SupportReport'),
  require('./Notification'),
  require('./SpotlightAward'),
  require('./SpotlightReaction'),
  require('./PushToken'),
  require('./RegistrationOtp'),
  require('./RewardTransaction'),
  require('./RewardPayout'),
  require('./PaymentTransaction'),
  require('./CommunityPost'),
  require('./CommunityReply'),
  require('./StudyGroup'),
  require('./StudyGroupMember'),
  require('./StudyGroupMessage'),
  require('./ResourceFile'),
  require('./ReferralDownload'),
  require('./AdminAuditLog')
];

const db = {};
for (const defineModel of modelDefiners) {
  const model = defineModel(sequelize);
  db[model.name] = model;
}

// Run associations
Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;

async function ensureCommunityReplyMetadataColumn() {
  try {
    await sequelize.query(`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'community_replies'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'community_replies'
      AND column_name = 'metadata'
  ) THEN
    ALTER TABLE community_replies
      ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;
`);
    logger.info('community_replies.metadata verified (added if missing).');
  } catch (err) {
    logger.error(`Failed to ensure community_replies.metadata: ${err.message}`);
  }
}

async function ensureAcademicStateColumns() {
  try {
    await sequelize.query(`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'users'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'academic_last_progressed_at'
  ) THEN
    ALTER TABLE users
      ADD COLUMN academic_last_progressed_at TIMESTAMPTZ NULL;
  END IF;
END $$;
`);
    logger.info('Academic state columns verified (added if missing).');
  } catch (err) {
    logger.error(`Failed to ensure academic state columns: ${err.message}`);
  }
}

/** Keeps spotlight winners stable for their weekly/monthly reaction cycle. */
async function ensureSpotlightAwardsTable() {
  try {
    await sequelize.query(`
CREATE TABLE IF NOT EXISTS spotlight_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  award_id VARCHAR(160) NOT NULL UNIQUE,
  award_type VARCHAR(40) NOT NULL,
  cycle_key VARCHAR(80) NOT NULL,
  user_id UUID NULL,
  period_start TIMESTAMPTZ NULL,
  period_end TIMESTAMPTZ NULL,
  published_at TIMESTAMPTZ NULL,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS spotlight_awards_type_cycle_unique
  ON spotlight_awards(award_type, cycle_key);
CREATE INDEX IF NOT EXISTS spotlight_awards_user_type_idx
  ON spotlight_awards(user_id, award_type);
`);
    logger.info('spotlight_awards table verified.');
  } catch (err) {
    logger.error(`Failed to ensure spotlight_awards: ${err.message}`);
  }
}

async function ensureAdminAccessColumnsAndLogs() {
  try {
    await sequelize.query(`
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'users'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'is_superadmin'
    ) THEN
      ALTER TABLE users
        ADD COLUMN is_superadmin BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'admin_permissions'
    ) THEN
      ALTER TABLE users
        ADD COLUMN admin_permissions JSONB NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'admin_title'
    ) THEN
      ALTER TABLE users
        ADD COLUMN admin_title VARCHAR(120) NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'account_status'
    ) THEN
      ALTER TABLE users
        ADD COLUMN account_status VARCHAR(20) NOT NULL DEFAULT 'active';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'moderation_note'
    ) THEN
      ALTER TABLE users
        ADD COLUMN moderation_note TEXT NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'moderation_reason'
    ) THEN
      ALTER TABLE users
        ADD COLUMN moderation_reason TEXT NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'warned_at'
    ) THEN
      ALTER TABLE users
        ADD COLUMN warned_at TIMESTAMPTZ NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'suspended_until'
    ) THEN
      ALTER TABLE users
        ADD COLUMN suspended_until TIMESTAMPTZ NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'blocked_at'
    ) THEN
      ALTER TABLE users
        ADD COLUMN blocked_at TIMESTAMPTZ NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'deleted_at'
    ) THEN
      ALTER TABLE users
        ADD COLUMN deleted_at TIMESTAMPTZ NULL;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NULL,
  admin_name VARCHAR(255) NULL,
  admin_email VARCHAR(255) NULL,
  action VARCHAR(120) NOT NULL,
  section VARCHAR(80) NULL,
  method VARCHAR(12) NULL,
  path VARCHAR(500) NULL,
  status_code INTEGER NULL,
  target_type VARCHAR(80) NULL,
  target_id VARCHAR(120) NULL,
  ip_address VARCHAR(80) NULL,
  user_agent TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_admin_user_idx ON admin_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS admin_audit_logs_section_idx ON admin_audit_logs(section);
CREATE INDEX IF NOT EXISTS admin_audit_logs_action_idx ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS admin_audit_logs_created_at_idx ON admin_audit_logs(created_at);
`);
    logger.info('Admin access columns and audit log table verified.');
  } catch (err) {
    logger.error(`Failed to ensure admin access schema: ${err.message}`);
  }
}

async function connectAndSync() {
  await sequelize.authenticate();
  logger.info('Database connection established.');
  await ensureCommunityReplyMetadataColumn();
  await ensureAcademicStateColumns();
  await ensureSpotlightAwardsTable();
  await ensureAdminAccessColumnsAndLogs();
  const syncMode = config.startup.dbSyncMode;
  if (syncMode === 'force') {
    await sequelize.sync({ force: true });
    logger.warn('Database sync: force (DROPS TABLES)');
  } else if (syncMode === 'alter') {
    await sequelize.sync({ alter: true });
    logger.info('Database sync: alter');
  } else if (syncMode === 'none') {
    logger.info('Database sync: skipped');
  } else {
    await sequelize.sync();
    logger.info('Database sync: normal');
  }

  // Initialize plans if not present
  const shouldSeedPlans = config.startup.seedDefaultPlans;
  await db.Plan.initializeFreePlan();
  if (shouldSeedPlans && db.Plan && db.Plan.initializeDefaultPlans) {
    await db.Plan.initializeDefaultPlans();
  } else if (db.Plan && db.Plan.initializeDefaultPlans) {
    logger.info('Plan seeding skipped (set SEED_DEFAULT_PLANS=true to enable).');
  }

}

module.exports = { ...db, connectAndSync };
