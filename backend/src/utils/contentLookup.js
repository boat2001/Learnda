/**
 * Cross-table content utilities.
 * All content now lives in 4 dedicated tables; this module provides
 * helpers for looking up and operating on content regardless of table.
 */
const { Op } = require('sequelize');

// Maps content_type discriminator → Sequelize model name
const TYPE_TO_MODEL = {
  lesson: 'Lesson',
  video_lesson: 'VideoLesson',
  text_item: 'TextItem',
};

/**
 * Return the Sequelize model for a given content_type discriminator.
 * @param {object} db - the models object from require('../models')
 * @param {string} contentType - 'lesson' | 'video_lesson' | 'text_item'
 */
const getModel = (db, contentType) => {
  const name = TYPE_TO_MODEL[contentType];
  if (!name) throw new Error(`Unknown content_type: ${contentType}`);
  return db[name];
};

/**
 * Find a single content item by id across all tables using the all_content view.
 * Returns a plain object with content_type attached, or null.
 */
const findById = async (db, id) => {
  const { sequelize } = db;
  const [rows] = await sequelize.query(
    `SELECT * FROM all_content WHERE id = :id LIMIT 1`,
    { replacements: { id }, type: sequelize.QueryTypes.SELECT }
  );
  return rows || null;
};

/**
 * Find the content_type for a given id (fast single-column query).
 * Returns 'lesson' | 'video_lesson' | 'text_item' | null
 */
const getContentType = async (db, id) => {
  const { sequelize } = db;
  const [row] = await sequelize.query(
    `SELECT content_type FROM all_content WHERE id = :id LIMIT 1`,
    { replacements: { id }, type: sequelize.QueryTypes.SELECT }
  );
  return row?.content_type || null;
};

/**
 * Find the Sequelize model instance for any content id.
 * Queries all_content view to determine the table, then fetches the full record.
 */
const findModelInstance = async (db, id, includeOptions = []) => {
  const contentType = await getContentType(db, id);
  if (!contentType) return null;
  const Model = getModel(db, contentType);
  return Model.findByPk(id, { include: includeOptions });
};

/**
 * Normalize a content row from all_content view to match the old content_items shape
 * expected by frontend consumers.
 */
const normalizeRow = (row) => {
  if (!row) return null;
  return {
    ...row,
    // Map content_type back to a type field frontends may expect
    type: row.content_type === 'lesson' ? 'text_lesson'
        : row.content_type === 'text_item' ? (row.subtype || 'text_item')
        : row.content_type, // video_lesson
  };
};

module.exports = {
  TYPE_TO_MODEL,
  getModel,
  findById,
  getContentType,
  findModelInstance,
  normalizeRow,
};
