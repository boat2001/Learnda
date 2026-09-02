// src/models/index.js
const { createSequelize } = require('../config/database');
const logger = require('../config/logger');
const config = require('../config/env');

const sequelize = createSequelize();

// Load model definers
const modelDefiners = [
  // K-12 education structure (learnda-dev-guide.md §2, §4)
  require('./LearningUnit'),
  require('./Institution'),
  require('./User'),
  require('./UserContact'),
  require('./RegistrationSession'),
  require('./AcademicProfile'),
  require('./AuthSession'),
  require('./RegistrationSecurityEvent'),
  require('./Progress'),
  require('./Lesson'),
  require('./VideoLesson'),
  require('./EduvhibeVideo'),
  require('./TextItem'),
  require('./ContentMetadata'),
  require('./ContentStats'),
  require('./Program'),
  require('./Course'),
  require('./CourseOffering'),
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
  require('./EduvhibeNote'),
  require('./EduvhibeCgpaEntry'),
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

const USER_TO_CATALOG_PROGRAM_CATEGORY = Object.freeze({
  'Primary Education': 'Primary',
  'JHS Education': 'JHS',
  'Early Childhood Education': 'ECE'
});

async function backfillLegacyAcademicColumns() {
  const { User, AcademicProfile, Program } = db;
  if (!User || !Program) return;

  const users = await User.findAll({
    where: { role: 'student' }
  });

  let repairedCount = 0;

  for (const user of users) {
    const academicProfileRow = AcademicProfile
      ? await AcademicProfile.findOne({ where: { user_id: user.id } })
      : null;
    const profileMetadata = academicProfileRow?.metadata && typeof academicProfileRow.metadata === 'object'
      ? academicProfileRow.metadata
      : {};
    const legacyAcademicProfile =
      user.preferences?.academic_profile && typeof user.preferences.academic_profile === 'object'
        ? user.preferences.academic_profile
        : {};

    const desiredProgrammeCategory =
      academicProfileRow?.programme_category ||
      legacyAcademicProfile.programme_category ||
      legacyAcademicProfile.program_category ||
      user.programme_category ||
      null;

    let desiredProgramId =
      academicProfileRow?.program_id ||
      legacyAcademicProfile.program_id ||
      user.program_id ||
      null;

    let desiredProgramName =
      profileMetadata.program_name ||
      legacyAcademicProfile.program_name ||
      user.program ||
      null;

    if (!desiredProgramId && desiredProgramName) {
      const catalogCategory = USER_TO_CATALOG_PROGRAM_CATEGORY[desiredProgrammeCategory] || null;
      const programWhere = { name: desiredProgramName };
      if (catalogCategory) {
        programWhere.category = catalogCategory;
      }

      const matchedProgram = await Program.findOne({ where: programWhere });
      if (matchedProgram) {
        desiredProgramId = matchedProgram.id;
        desiredProgramName = matchedProgram.name;
      }
    }

    const patch = {};
    if (desiredProgrammeCategory && String(user.programme_category || '') !== String(desiredProgrammeCategory)) {
      patch.programme_category = desiredProgrammeCategory;
    }
    if (desiredProgramId && String(user.program_id || '') !== String(desiredProgramId)) {
      patch.program_id = desiredProgramId;
    }
    if (desiredProgramName && String(user.program || '') !== String(desiredProgramName)) {
      patch.program = desiredProgramName;
    }

    if (Object.keys(patch).length) {
      await user.update(patch);
      repairedCount += 1;
    }
  }

  if (repairedCount > 0) {
    logger.info(`Academic user-column backfill repaired ${repairedCount} student record(s).`);
  }
}

/** Creates eduvhibe_notes table and migrates records from resource_files if needed. */
async function ensureEduvhibeNotesTable() {
  try {
    await sequelize.query(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'eduvhibe_notes'
  ) THEN
    CREATE TABLE eduvhibe_notes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      file_name VARCHAR(255) NOT NULL,
      file_url VARCHAR(500) NOT NULL,
      file_path VARCHAR(500),
      file_type VARCHAR(100),
      file_size INTEGER,
      course VARCHAR(255),
      level VARCHAR(50),
      semester VARCHAR(50),
      is_premium BOOLEAN DEFAULT false,
      downloads INTEGER DEFAULT 0,
      views INTEGER DEFAULT 0,
      last_viewed_at TIMESTAMPTZ,
      last_downloaded_at TIMESTAMPTZ,
      uploader_id UUID,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;

  -- Migrate any existing eduvhibe notes from resource_files
  INSERT INTO eduvhibe_notes (
    id, title, description, file_name, file_url, file_path, file_type, file_size,
    course, level, semester, is_premium, downloads, views,
    last_viewed_at, last_downloaded_at, uploader_id, created_at, updated_at
  )
  SELECT
    id, title, description, file_name,
    COALESCE(file_url, ''), file_path, file_type, file_size,
    course, level, semester, COALESCE(is_premium, false),
    COALESCE(downloads, 0), COALESCE(views, 0),
    last_viewed_at, last_downloaded_at, uploader_id, created_at, updated_at
  FROM resource_files
  WHERE category = 'eduvhibe_note'
  ON CONFLICT (id) DO NOTHING;

  DELETE FROM resource_files WHERE category = 'eduvhibe_note';
END $$;
`);
    logger.info('eduvhibe_notes table verified and migrated.');
  } catch (err) {
    logger.error(`Failed to ensure eduvhibe_notes: ${err.message}`);
  }
}

/** Adds community_replies.metadata when the model expects it but legacy DBs lack the column. */
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
      AND table_name = 'institutions'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'institutions'
      AND column_name = 'metadata'
  ) THEN
    ALTER TABLE institutions
      ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;

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
  await ensureEduvhibeNotesTable();
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
  if (shouldSeedPlans && db.Plan && db.Plan.initializeDefaultPlans) {
    await db.Plan.initializeDefaultPlans();
  } else if (db.Plan && db.Plan.initializeDefaultPlans) {
    logger.info('Plan seeding skipped (set SEED_DEFAULT_PLANS=true to enable).');
  }

  if (config.startup.runLegacyAcademicBackfill) {
    await backfillLegacyAcademicColumns();
  } else {
    logger.info('Legacy academic backfill skipped (set RUN_LEGACY_ACADEMIC_BACKFILL=true to enable).');
  }
}

module.exports = { ...db, connectAndSync };
