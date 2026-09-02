/* eslint-disable no-console */
/**
 * Migration: content_items → dedicated tables
 *
 * Creates: lessons, video_lessons, eduvhibe_videos, text_items
 * Creates: all_content view
 * Drops: FK constraints on dependent tables, then content_items
 *
 * Run from backend/: node src/scripts/migrate_to_dedicated_tables.js
 */
require('../config/loadEnv').loadEnv();
const { Client } = require('pg');

const client = new Client(process.env.DATABASE_URL);

const EDUVHIBE_TAGS = ['eduvhibe', 'eduvhibe_video', 'eduvhibe_guide'];

async function run() {
  await client.connect();
  console.log('Connected to database');

  await client.query('BEGIN');
  try {
    // ── 1. Create new tables ────────────────────────────────────────────────

    await client.query(`
      CREATE TABLE IF NOT EXISTS lessons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(500) NOT NULL,
        description TEXT,
        course_id UUID,
        lesson_number INTEGER,
        status VARCHAR(20) NOT NULL DEFAULT 'published',
        is_premium BOOLEAN NOT NULL DEFAULT false,
        creator_id UUID NOT NULL,
        depth_level VARCHAR(20) NOT NULL DEFAULT 'basic',
        tags TEXT[] DEFAULT '{}',
        thumbnail_url VARCHAR(500),
        word_count INTEGER,
        duration_minutes INTEGER,
        reading_time INTEGER,
        slug VARCHAR(200),
        level VARCHAR(20),
        semester VARCHAR(20),
        source VARCHAR(100),
        lesson_document JSONB DEFAULT '{}',
        exercises JSONB DEFAULT '[]',
        objectives JSONB DEFAULT '[]',
        metadata JSONB DEFAULT '{}',
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log('Created lessons table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS video_lessons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(500) NOT NULL,
        description TEXT,
        course_id UUID,
        lesson_number INTEGER,
        status VARCHAR(20) NOT NULL DEFAULT 'published',
        is_premium BOOLEAN NOT NULL DEFAULT false,
        creator_id UUID NOT NULL,
        depth_level VARCHAR(20) NOT NULL DEFAULT 'basic',
        tags TEXT[] DEFAULT '{}',
        thumbnail_url VARCHAR(500),
        file_url VARCHAR(500),
        video_url VARCHAR(1000),
        duration_minutes INTEGER,
        level VARCHAR(20),
        semester VARCHAR(20),
        section VARCHAR(200),
        metadata JSONB DEFAULT '{}',
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log('Created video_lessons table');

    await client.query(`
      CREATE TABLE IF NOT EXISTS eduvhibe_videos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(500) NOT NULL,
        description TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'published',
        is_premium BOOLEAN NOT NULL DEFAULT false,
        creator_id UUID NOT NULL,
        depth_level VARCHAR(20) NOT NULL DEFAULT 'basic',
        tags TEXT[] DEFAULT '{}',
        thumbnail_url VARCHAR(500),
        file_url VARCHAR(500),
        video_url VARCHAR(1000),
        duration_minutes INTEGER,
        level VARCHAR(20),
        section VARCHAR(200),
        section_code VARCHAR(50),
        metadata JSONB DEFAULT '{}',
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log('Created eduvhibe_videos table');

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'text_item_subtype') THEN
          CREATE TYPE text_item_subtype AS ENUM (
            'story', 'quote', 'fact', 'jocular',
            'article', 'blog_post', 'guide', 'note', 'announcement',
            'quiz', 'exam', 'past_question'
          );
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS text_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        subtype text_item_subtype NOT NULL,
        title VARCHAR(500),
        description TEXT,
        body TEXT,
        author VARCHAR(200),
        category VARCHAR(200),
        tone VARCHAR(100),
        key_lesson TEXT,
        slug VARCHAR(200),
        status VARCHAR(20) NOT NULL DEFAULT 'published',
        is_premium BOOLEAN NOT NULL DEFAULT false,
        creator_id UUID NOT NULL,
        depth_level VARCHAR(20) NOT NULL DEFAULT 'basic',
        tags TEXT[] DEFAULT '{}',
        word_count INTEGER,
        reading_time INTEGER,
        questions JSONB DEFAULT '[]',
        sections JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log('Created text_items table');

    // ── 2. Migrate data ─────────────────────────────────────────────────────

    // text_lesson → lessons
    const { rows: lessonRows } = await client.query(`
      SELECT * FROM content_items WHERE type = 'text_lesson'
    `);
    for (const row of lessonRows) {
      const m = row.metadata || {};
      await client.query(`
        INSERT INTO lessons (
          id, title, description, course_id, lesson_number, status, is_premium,
          creator_id, depth_level, tags, thumbnail_url, word_count, duration_minutes,
          reading_time, slug, level, semester, source,
          lesson_document, exercises, objectives, metadata, published_at, created_at, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25
        ) ON CONFLICT (id) DO NOTHING
      `, [
        row.id,
        row.title,
        row.description,
        m.course_id || null,
        m.lesson_number || m.sequence || null,
        row.status,
        row.is_premium,
        row.creator_id,
        row.depth_level || 'basic',
        row.tags || [],
        row.thumbnail_url,
        row.word_count,
        row.duration_minutes || m.duration_minutes || null,
        m.reading_time || null,
        m.slug || null,
        m.level || null,
        m.semester || null,
        m.source || null,
        JSON.stringify(m.lesson_document || {}),
        JSON.stringify(m.exercises || []),
        JSON.stringify(m.objectives || []),
        JSON.stringify(m),
        row.published_at,
        row.created_at,
        row.updated_at,
      ]);
    }
    console.log(`Migrated ${lessonRows.length} lessons`);

    // video — split by eduvhibe tags
    const { rows: videoRows } = await client.query(`
      SELECT * FROM content_items WHERE type = 'video'
    `);
    let eduvhibeCount = 0;
    let videoLessonCount = 0;
    for (const row of videoRows) {
      const m = row.metadata || {};
      const tags = row.tags || [];
      const isEduvhibe = tags.some((t) => EDUVHIBE_TAGS.includes(t));

      if (isEduvhibe) {
        await client.query(`
          INSERT INTO eduvhibe_videos (
            id, title, description, status, is_premium, creator_id, depth_level,
            tags, thumbnail_url, file_url, video_url, duration_minutes, level, section,
            section_code, metadata, published_at, created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
          ON CONFLICT (id) DO NOTHING
        `, [
          row.id, row.title, row.description, row.status, row.is_premium,
          row.creator_id, row.depth_level || 'basic', tags, row.thumbnail_url,
          row.file_url, m.video_url || row.file_url,
          row.duration_minutes,
          m.level || null, m.section || null, m.section_code || null,
          JSON.stringify(m), row.published_at, row.created_at, row.updated_at,
        ]);
        eduvhibeCount++;
      } else {
        await client.query(`
          INSERT INTO video_lessons (
            id, title, description, course_id, lesson_number, status, is_premium, creator_id,
            depth_level, tags, thumbnail_url, file_url, video_url, duration_minutes,
            level, semester, section, metadata, published_at, created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
          ON CONFLICT (id) DO NOTHING
        `, [
          row.id, row.title, row.description,
          m.course_id || null, m.lesson_number || null,
          row.status, row.is_premium, row.creator_id, row.depth_level || 'basic',
          tags, row.thumbnail_url, row.file_url,
          m.video_url || row.file_url,
          row.duration_minutes,
          m.level || null, m.semester || null, m.section || null,
          JSON.stringify(m), row.published_at, row.created_at, row.updated_at,
        ]);
        videoLessonCount++;
      }
    }
    console.log(`Migrated ${eduvhibeCount} eduvhibe_videos, ${videoLessonCount} video_lessons`);

    // edutainment / quote / blog → text_items
    const subtypeMap = {
      edutainment: 'story',
      quote: 'quote',
      blog: 'blog_post',
    };
    const { rows: textRows } = await client.query(`
      SELECT * FROM content_items WHERE type IN ('edutainment','quote','blog')
    `);
    for (const row of textRows) {
      const m = row.metadata || {};
      const tags = row.tags || [];
      let subtype = subtypeMap[row.type] || 'article';
      // eduvhibe blog → guide
      if (row.type === 'blog' && tags.some((t) => EDUVHIBE_TAGS.includes(t))) subtype = 'guide';
      // edutainment with story tag → story, otherwise check category
      if (row.type === 'edutainment') {
        const cat = String(m.category || m.normalized_category || '').toLowerCase();
        if (cat.includes('quote')) subtype = 'quote';
        else if (cat.includes('fact') || cat.includes('did_you_know')) subtype = 'fact';
        else if (cat.includes('jocul') || cat.includes('joke')) subtype = 'jocular';
        else subtype = 'story';
      }

      await client.query(`
        INSERT INTO text_items (
          id, subtype, title, description, body, author, category, tone, key_lesson, slug,
          status, is_premium, creator_id, depth_level, tags, word_count, reading_time,
          questions, sections, metadata, published_at, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
        ON CONFLICT (id) DO NOTHING
      `, [
        row.id, subtype, row.title, row.description,
        m.body || m.content || row.description || null,
        m.author || null,
        m.category || m.normalized_category || null,
        m.tone || null,
        m.key_lesson || null,
        m.slug || null,
        row.status, row.is_premium, row.creator_id, row.depth_level || 'basic',
        tags, row.word_count,
        (() => { const v = m.read_time || m.reading_time; const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; })(),
        JSON.stringify(m.questions || []),
        JSON.stringify(m.sections || {}),
        JSON.stringify(m),
        row.published_at, row.created_at, row.updated_at,
      ]);
    }
    console.log(`Migrated ${textRows.length} text_items`);

    // ── 3. Create all_content view ──────────────────────────────────────────
    await client.query(`DROP VIEW IF EXISTS all_content`);
    await client.query(`
      CREATE VIEW all_content AS
        SELECT
          id, 'lesson'::TEXT AS content_type, NULL::TEXT AS subtype,
          title, description, status, is_premium, creator_id, depth_level, tags,
          thumbnail_url, NULL::VARCHAR AS file_url, NULL::VARCHAR AS video_url,
          duration_minutes, word_count, published_at, created_at, updated_at,
          course_id, lesson_number, level,
          NULL::TEXT AS category, NULL::TEXT AS tone, NULL::TEXT AS body, NULL::TEXT AS author,
          metadata, lesson_document, exercises, objectives,
          NULL::JSONB AS questions, NULL::JSONB AS sections
        FROM lessons

        UNION ALL

        SELECT
          id, 'video_lesson'::TEXT AS content_type, NULL::TEXT AS subtype,
          title, description, status, is_premium, creator_id, depth_level, tags,
          thumbnail_url, file_url, video_url,
          duration_minutes, NULL::INTEGER AS word_count, published_at, created_at, updated_at,
          course_id, lesson_number, level,
          NULL::TEXT AS category, NULL::TEXT AS tone, NULL::TEXT AS body, NULL::TEXT AS author,
          metadata, NULL::JSONB AS lesson_document, NULL::JSONB AS exercises, NULL::JSONB AS objectives,
          NULL::JSONB AS questions, NULL::JSONB AS sections
        FROM video_lessons

        UNION ALL

        SELECT
          id, 'eduvhibe_video'::TEXT AS content_type, NULL::TEXT AS subtype,
          title, description, status, is_premium, creator_id, depth_level, tags,
          thumbnail_url, file_url, video_url,
          duration_minutes, NULL::INTEGER AS word_count, published_at, created_at, updated_at,
          NULL::UUID AS course_id, NULL::INTEGER AS lesson_number, level,
          NULL::TEXT AS category, NULL::TEXT AS tone, NULL::TEXT AS body, NULL::TEXT AS author,
          metadata, NULL::JSONB AS lesson_document, NULL::JSONB AS exercises, NULL::JSONB AS objectives,
          NULL::JSONB AS questions, NULL::JSONB AS sections
        FROM eduvhibe_videos

        UNION ALL

        SELECT
          id, 'text_item'::TEXT AS content_type, subtype::TEXT,
          title, description, status, is_premium, creator_id, depth_level, tags,
          NULL::VARCHAR AS thumbnail_url, NULL::VARCHAR AS file_url, NULL::VARCHAR AS video_url,
          NULL::INTEGER AS duration_minutes, word_count, published_at, created_at, updated_at,
          NULL::UUID AS course_id, NULL::INTEGER AS lesson_number, NULL::TEXT AS level,
          category, tone, body, author,
          metadata, NULL::JSONB AS lesson_document, NULL::JSONB AS exercises, NULL::JSONB AS objectives,
          questions, sections
        FROM text_items
    `);
    console.log('Created all_content view');

    // ── 4. Drop FK constraints and content_items ────────────────────────────
    const fksToDrop = [
      ['comments', 'comments_content_id_fkey'],
      ['content_engagements', 'content_engagements_content_id_fkey'],
      ['content_metadata', 'content_metadata_content_id_fkey'],
      ['content_stats', 'content_stats_content_id_fkey'],
      ['contributions', 'contributions_content_id_fkey'],
      ['past_question_modes', 'past_question_modes_content_id_fkey'],
      ['pls_items', 'pls_items_content_id_fkey'],
    ];

    for (const [table, constraint] of fksToDrop) {
      await client.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS "${constraint}"`);
      console.log(`Dropped FK: ${constraint}`);
    }

    // Also drop the enum type constraints on content_items
    await client.query(`DROP TABLE IF EXISTS content_items CASCADE`);
    console.log('Dropped content_items table');

    // Drop old enum types that were tied to content_items
    await client.query(`DROP TYPE IF EXISTS enum_content_items_type CASCADE`);
    await client.query(`DROP TYPE IF EXISTS enum_content_items_depth_level CASCADE`);
    await client.query(`DROP TYPE IF EXISTS enum_content_items_visual_type CASCADE`);
    await client.query(`DROP TYPE IF EXISTS enum_content_items_status CASCADE`);
    console.log('Dropped old content_items enum types');

    // ── 5. Add indexes ──────────────────────────────────────────────────────
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_lessons_course_id ON lessons(course_id)`,
      `CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons(status)`,
      `CREATE INDEX IF NOT EXISTS idx_lessons_tags ON lessons USING gin(tags)`,
      `CREATE INDEX IF NOT EXISTS idx_video_lessons_course_id ON video_lessons(course_id)`,
      `CREATE INDEX IF NOT EXISTS idx_video_lessons_status ON video_lessons(status)`,
      `CREATE INDEX IF NOT EXISTS idx_eduvhibe_videos_status ON eduvhibe_videos(status)`,
      `CREATE INDEX IF NOT EXISTS idx_eduvhibe_videos_tags ON eduvhibe_videos USING gin(tags)`,
      `CREATE INDEX IF NOT EXISTS idx_text_items_subtype ON text_items(subtype)`,
      `CREATE INDEX IF NOT EXISTS idx_text_items_status ON text_items(status)`,
      `CREATE INDEX IF NOT EXISTS idx_text_items_tags ON text_items USING gin(tags)`,
      `CREATE INDEX IF NOT EXISTS idx_content_stats_content_id ON content_stats(content_id)`,
      `CREATE INDEX IF NOT EXISTS idx_content_engagements_content_id ON content_engagements(content_id)`,
    ];
    for (const sql of indexes) {
      await client.query(sql);
    }
    console.log('Created indexes');

    await client.query('COMMIT');
    console.log('\n✓ Migration complete');

    // ── 6. Verify ───────────────────────────────────────────────────────────
    const { rows: counts } = await client.query(`
      SELECT 'lessons' AS t, COUNT(*) FROM lessons
      UNION ALL SELECT 'video_lessons', COUNT(*) FROM video_lessons
      UNION ALL SELECT 'eduvhibe_videos', COUNT(*) FROM eduvhibe_videos
      UNION ALL SELECT 'text_items', COUNT(*) FROM text_items
      UNION ALL SELECT 'all_content (view)', COUNT(*) FROM all_content
    `);
    counts.forEach((r) => console.log(` ${r.t}: ${r.count}`));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed — rolled back:', err.message);
    throw err;
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
