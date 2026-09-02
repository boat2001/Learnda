'use strict';

const { QueryTypes } = require('sequelize');
const { sequelize, Course } = require('../models');

/** Students whose academic profile (or legacy user columns) matches a course_offering row for this course. */
async function fetchProgramEnrolledStudentIds(courseId) {
  const replacements = { courseId };

  const fromProfiles = await sequelize.query(
    `
    SELECT DISTINCT ap.user_id AS id
    FROM academic_profiles ap
    INNER JOIN users u ON u.id = ap.user_id AND u.role = 'student'
    WHERE EXISTS (
      SELECT 1
      FROM course_offerings co
      WHERE co.course_id = :courseId
        AND co.program_id = ap.program_id
        AND (
          co.level IS NULL
          OR trim(both FROM co.level) = trim(both FROM ap.level)
        )
        AND (
          co.semester IS NULL
          OR trim(both FROM co.semester) = trim(both FROM ap.semester)
        )
    )
    `,
    { replacements, type: QueryTypes.SELECT }
  );

  const fromLegacyUsers = await sequelize.query(
    `
    SELECT DISTINCT u.id AS id
    FROM users u
    WHERE u.role = 'student'
      AND u.program_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM academic_profiles ap WHERE ap.user_id = u.id)
      AND EXISTS (
        SELECT 1
        FROM course_offerings co
        WHERE co.course_id = :courseId
          AND co.program_id = u.program_id
          AND (
            co.level IS NULL
            OR (u.level IS NOT NULL AND trim(both FROM co.level) = trim(both FROM u.level))
          )
          AND (
            co.semester IS NULL
            OR (u.semester IS NOT NULL AND trim(both FROM co.semester) = trim(both FROM u.semester))
          )
      )
    `,
    { replacements, type: QueryTypes.SELECT }
  );

  const merged = new Set();
  [...fromProfiles, ...fromLegacyUsers].forEach((row) => {
    if (row?.id) merged.add(String(row.id));
  });
  return merged;
}

/** Students who have any learning engagement tied to this course via content metadata. */
async function fetchEngagedStudentIds(courseIdStr, courseTitle) {
  const trimmedTitle = String(courseTitle || '').trim();

  let titlePredicate = '';
  const replacements = { courseIdStr };
  if (trimmedTitle) {
    titlePredicate = `OR c.title = :courseTitle`;
    replacements.courseTitle = trimmedTitle;
  }

  const rows = await sequelize.query(
    `
    SELECT DISTINCT ce.user_id AS id
    FROM content_engagements ce
    INNER JOIN users u ON u.id = ce.user_id AND u.role = 'student'
    INNER JOIN all_content ac ON ac.id = ce.content_id AND ac.status = 'published'
    LEFT JOIN courses c ON c.id = ac.course_id
    WHERE ce.user_id IS NOT NULL
      AND ce.action IN ('view', 'complete')
      AND ac.content_type IN ('lesson', 'video_lesson')
      AND (
        ac.course_id::text = :courseIdStr
        ${titlePredicate}
      )
    `,
    {
      replacements,
      type: QueryTypes.SELECT,
    }
  );

  const set = new Set();
  rows.forEach((row) => {
    if (row?.id) set.add(String(row.id));
  });
  return set;
}

async function getCourseStudyMetrics(courseId) {
  if (!courseId) {
    return { currently_studying: 0, total_studied: 0 };
  }

  const course = await Course.findByPk(courseId, {
    attributes: ['id', 'title'],
  });
  if (!course) {
    return { currently_studying: 0, total_studied: 0 };
  }

  const courseIdStr = String(course.id);
  const courseTitle = String(course.title || '').trim();

  const [programEnrolled, engaged] = await Promise.all([
    fetchProgramEnrolledStudentIds(courseId),
    fetchEngagedStudentIds(courseIdStr, courseTitle),
  ]);

  const haveStudied = new Set(programEnrolled);
  engaged.forEach((id) => haveStudied.add(id));

  return {
    currently_studying: programEnrolled.size,
    total_studied: haveStudied.size,
  };
}

module.exports = {
  getCourseStudyMetrics,
  fetchProgramEnrolledStudentIds,
  fetchEngagedStudentIds,
};
