/* eslint-disable no-console */
/**
 * Single source of truth for the `all_content` view definition.
 *
 * The view UNIONs the three dedicated content tables (lessons, video_lessons,
 * text_items) into one shape the read paths query. Keeping the
 * DDL here means refresh_all_content_view.js and sync_content_to_target.js can
 * never drift apart. Editing a column? Edit it once, here.
 */

const ALL_CONTENT_VIEW_SQL = `
  CREATE VIEW all_content AS
    SELECT
      id, 'lesson'::TEXT AS content_type, NULL::TEXT AS subtype,
      title, description, status, is_premium, creator_id, depth_level, tags,
      thumbnail_url, NULL::VARCHAR AS file_url, NULL::VARCHAR AS video_url,
      duration_minutes, word_count, published_at, created_at, updated_at,
      course_id, lesson_number, level,
      NULL::TEXT AS category, NULL::TEXT AS tone, NULL::TEXT AS body, NULL::TEXT AS author,
      metadata, lesson_document, exercises, objectives, final_assessment,
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
      metadata, NULL::JSONB AS lesson_document, NULL::JSONB AS exercises, NULL::JSONB AS objectives, NULL::JSONB AS final_assessment,
      NULL::JSONB AS questions, NULL::JSONB AS sections
    FROM video_lessons


    UNION ALL

    SELECT
      id, 'text_item'::TEXT AS content_type, subtype::TEXT,
      title, description, status, is_premium, creator_id, depth_level, tags,
      NULL::VARCHAR AS thumbnail_url, NULL::VARCHAR AS file_url, NULL::VARCHAR AS video_url,
      NULL::INTEGER AS duration_minutes, word_count, published_at, created_at, updated_at,
      NULL::UUID AS course_id, NULL::INTEGER AS lesson_number, NULL::TEXT AS level,
      category, tone, body, author,
      metadata, NULL::JSONB AS lesson_document, NULL::JSONB AS exercises, NULL::JSONB AS objectives, NULL::JSONB AS final_assessment,
      questions, sections
    FROM text_items
`;

/**
 * Drop and recreate the all_content view on the given connected pg client.
 * Idempotent and safe to run repeatedly — a view holds no data of its own.
 */
async function refreshAllContentView(client) {
  await client.query('DROP VIEW IF EXISTS all_content');
  await client.query(ALL_CONTENT_VIEW_SQL);
}

module.exports = { ALL_CONTENT_VIEW_SQL, refreshAllContentView };
