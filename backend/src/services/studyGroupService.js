const { Op, fn, col } = require('sequelize');
const {
  Course,
  StudyGroup,
  StudyGroupMember,
  StudyGroupMessage,
  User
} = require('../models');
const {
  fetchCurrentLearning
} = require('./currentLearningService');

const AUTO_GROUP_SOURCE = 'general_course_auto';
const COURSE_GROUP_SOURCE = 'course_official';
const DEFAULT_MEMBER_LIMIT = 150;
const DISCOVER_LIMIT = 12;
const GROUP_ID_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const { processMessage, MAX_LENGTH: MESSAGE_BODY_MAX } = require('../utils/chatFilter');
const MESSAGES_PAGE_SIZE = 50;

const assertValidGroupId = (groupId) => {
  if (!groupId || !GROUP_ID_UUID.test(String(groupId))) {
    const error = new Error('Invalid study group id');
    error.status = 400;
    throw error;
  }
};

const serializeAuthor = (author) => ({
  id: author?.id || null,
  full_name: author?.full_name || 'Student',
  avatar_url: author?.avatar_url || null
});

const serializeMessage = (message, author) => ({
  id: message.id,
  body: message.body,
  metadata: message.metadata && typeof message.metadata === 'object' ? message.metadata : {},
  // Sequelize instances use createdAt; plain rows / JSON may use created_at
  created_at: message.created_at ?? message.createdAt ?? null,
  author: serializeAuthor(author)
});

const sanitizeLinkPayload = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const kind = String(raw.kind || '').toLowerCase();
  if (!['lesson', 'practice', 'edutainment'].includes(kind)) return null;
  const title = String(raw.title || '').trim().slice(0, 240);
  const url = String(raw.url || '').trim().slice(0, 2048);
  if (!title || !url) return null;
  if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) return null;
  const subtitle = String(raw.subtitle || '').trim().slice(0, 240);
  return { kind, title, url, ...(subtitle ? { subtitle } : {}) };
};

const extractLinkFromMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object') return null;
  if (metadata.link && typeof metadata.link === 'object') {
    return sanitizeLinkPayload(metadata.link);
  }
  return sanitizeLinkPayload(metadata);
};

const resolveSystemOwnerId = async (fallbackUserId = null) => {
  const adminUser = await User.findOne({
    where: { role: 'admin' },
    order: [['created_at', 'ASC']]
  });
  if (adminUser?.id) return adminUser.id;

  const firstUser = await User.findOne({
    order: [['created_at', 'ASC']]
  });
  if (firstUser?.id) return firstUser.id;

  return fallbackUserId || null;
};

// "Math 101 Study Group" → "Math 101"; keep custom titles untouched.
const stripGroupSuffix = (rawTitle = '') => {
  const text = String(rawTitle || '').trim();
  if (!text) return text;
  return text.replace(/\s*study\s+group\s*$/i, '').trim() || text;
};

const buildGroupDescription = (course) => {
  const courseTitle = String(course?.title || 'this course').trim();
  const courseCode = String(course?.code || '').trim();
  return courseCode
    ? `Discuss ${courseTitle} (${courseCode}), share files, and study with other students taking this general course this semester.`
    : `Discuss ${courseTitle}, share files, and study with other students taking this general course this semester.`;
};

const buildCourseGroupMetadata = ({ course, learning, programmeCategory }) => ({
  source: COURSE_GROUP_SOURCE,
  auto_managed: true,
  course_code: course?.code || null,
  course_title: course?.title || null,
  level: learning?.academicProfile?.level || null,
  semester: learning?.academicProfile?.semester || null,
  programme_category: programmeCategory || learning?.academicProfile?.programme_category || null
});

const serializeGroup = ({ group, course, memberCount = 0, isJoined = false, lastActivityAt = null }) => {
  const metadata = (group && typeof group.metadata === 'object' && group.metadata) || {};
  const source = String(metadata.source || '').toLowerCase();
  const isOfficial = source === COURSE_GROUP_SOURCE || source === AUTO_GROUP_SOURCE;
  // For official course groups, use the course title (no "Study Group" suffix);
  // for custom groups, keep the creator's chosen title verbatim.
  const displayTitle = isOfficial
    ? (course?.title || group.course?.title || stripGroupSuffix(group.title) || group.title || 'Study group')
    : (group.title || 'Study group');

  // Audience: "course" / "class" / "level" — populated by metadata for custom groups.
  // For official groups, audience defaults to "course".
  const audienceType = String(metadata.audience_type || metadata.audience || (isOfficial ? 'course' : '')).toLowerCase() || null;
  const audienceLabel = String(metadata.audience_label || metadata.class_label || metadata.level_label || '').trim() || null;
  const purpose = String(metadata.purpose || (isOfficial ? 'learning' : '')).toLowerCase() || null;

  return {
    id: group.id,
    title: displayTitle,
    description: group.description || buildGroupDescription(course || group.course || {}),
    member_count: memberCount,
    active_members: memberCount,
    member_limit: group.member_limit || DEFAULT_MEMBER_LIMIT,
    is_joined: Boolean(isJoined),
    is_official: isOfficial,
    purpose,
    audience_type: audienceType,
    audience_label: audienceLabel,
    visibility: group.visibility,
    join_requirement: group.join_requirement,
    status: group.status,
    course_id: course?.id || group.course_id || null,
    course_name: course?.title || group.course?.title || null,
    course_code: course?.code || group.course?.code || null,
    programme_category: metadata.programme_category || null,
    level: metadata.level || null,
    semester: metadata.semester || null,
    avatar_url: metadata.avatar_url || null,
    created_at: group.created_at || group.createdAt || null,
    last_activity_at: lastActivityAt,
    last_message_at: lastActivityAt,
    metadata
  };
};

// Cheap lookup of last-message timestamp per group, used to surface
// "last interacted" without an N+1 query per card.
const fetchLastMessageMap = async (groupIds = []) => {
  if (!Array.isArray(groupIds) || !groupIds.length) return new Map();
  const rows = await StudyGroupMessage.findAll({
    where: { group_id: { [Op.in]: groupIds } },
    attributes: ['group_id', [fn('MAX', col('created_at')), 'last_at']],
    group: ['group_id'],
    raw: true
  });
  const map = new Map();
  rows.forEach((row) => {
    if (row && row.group_id) {
      map.set(String(row.group_id), row.last_at || null);
    }
  });
  return map;
};

const isSyntheticOwnerMembership = (group, membership) => {
  return Boolean(
    group?.metadata?.auto_managed &&
    membership?.role === 'owner' &&
    String(membership?.user_id || '') === String(group?.creator_user_id || '')
  );
};

const serializeRoomMember = (membership, currentUserId) => {
  const memberUser = membership?.user || {};
  const lastActiveAt = memberUser.last_active_at || memberUser.lastActiveAt || null;
  const lastActiveMs = lastActiveAt ? new Date(lastActiveAt).getTime() : NaN;
  const activeNow =
    String(membership?.user_id || '') === String(currentUserId || '') ||
    (Number.isFinite(lastActiveMs) && Date.now() - lastActiveMs < 5 * 60 * 1000);

  return {
    id: membership.user_id,
    user_id: membership.user_id,
    full_name: memberUser.full_name || 'Student',
    avatar_url: memberUser.avatar_url || null,
    role: membership.role || 'member',
    active_now: activeNow,
    online: activeNow
  };
};

const autoEnrollUserInGroups = async ({ userId, groupIds = [] }) => {
  if (!userId || !groupIds.length) return new Set();
  const existing = await StudyGroupMember.findAll({
    where: {
      user_id: userId,
      group_id: { [Op.in]: groupIds }
    },
    attributes: ['id', 'group_id', 'status', 'joined_at', 'left_at']
  });

  const existingByGroupId = new Map(existing.map((row) => [String(row.group_id), row]));
  const joinedIds = new Set();

  for (const groupId of groupIds) {
    const key = String(groupId);
    const row = existingByGroupId.get(key);
    if (row) {
      if (row.status !== 'active') {
        await row.update({
          status: 'active',
          left_at: null,
          joined_at: row.joined_at || new Date()
        });
      }
      joinedIds.add(key);
      continue;
    }

    try {
      await StudyGroupMember.create({
        group_id: groupId,
        user_id: userId,
        role: 'member',
        status: 'active',
        joined_at: new Date()
      });
      joinedIds.add(key);
    } catch (error) {
      // Unique race conditions are fine; treat as joined
      joinedIds.add(key);
    }
  }

  return joinedIds;
};

const countVisibleMembersFromMemberships = (group, memberships = []) => {
  return memberships.filter((membership) => !isSyntheticOwnerMembership(group, membership)).length;
};

const ensureCourseGroups = async ({ courses, learning, ownerUserId, user }) => {
  if (!Array.isArray(courses) || !courses.length) {
    return new Map();
  }

  const existingGroups = await StudyGroup.findAll({
    where: {
      course_id: { [Op.in]: courses.map((course) => course.id) },
      status: 'active'
    },
    include: [
      { model: Course, as: 'course', required: false }
    ]
  });

  const groupByCourseId = new Map(
    existingGroups
      .filter((group) => group.course_id)
      .map((group) => [String(group.course_id), group])
  );

  for (const course of courses) {
    const courseKey = String(course.id);
    if (groupByCourseId.has(courseKey)) continue;

    const createdGroup = await StudyGroup.create({
      creator_user_id: ownerUserId || user?.id,
      course_id: course.id,
      institution_id: null,
      title: stripGroupSuffix(course.title) || course.title,
      description: buildGroupDescription(course),
      visibility: 'public',
      join_requirement: 'serious_or_master',
      status: 'active',
      member_limit: DEFAULT_MEMBER_LIMIT,
      metadata: buildCourseGroupMetadata({
        course,
        learning,
        programmeCategory: (learning?.resolvedProgramCategories || [])[0] || null
      })
    });

    groupByCourseId.set(courseKey, createdGroup);
  }

  return groupByCourseId;
};

const fetchCurrentStudyGroups = async ({ user, query = {} }) => {
  const learning = await fetchCurrentLearning({ user, query });

  if (learning.missingProfile || !Array.isArray(learning.courses) || !learning.courses.length) {
    return {
      groups: [],
      academicProfile: learning.academicProfile,
      resolvedProgramCategories: learning.resolvedProgramCategories,
      missingProfile: learning.missingProfile
    };
  }

  const ownerUserId = await resolveSystemOwnerId(user?.id);
  const groupByCourseId = await ensureCourseGroups({
    courses: learning.courses,
    learning,
    ownerUserId,
    user
  });

  const groups = Array.from(groupByCourseId.values());
  const groupIds = groups.map((group) => group.id);

  // Auto-enrol the user in all of their official course groups
  if (user?.id && groupIds.length) {
    await autoEnrollUserInGroups({ userId: user.id, groupIds });
  }

  const memberships = groupIds.length
    ? await StudyGroupMember.findAll({
        where: {
          group_id: { [Op.in]: groupIds },
          status: 'active'
        }
      })
    : [];

  const membershipsByGroupId = memberships.reduce((acc, membership) => {
    const groupId = String(membership.group_id);
    if (!acc[groupId]) acc[groupId] = [];
    acc[groupId].push(membership);
    return acc;
  }, {});
  const joinedGroupIds = new Set(
    memberships
      .filter((membership) => String(membership.user_id) === String(user.id))
      .map((membership) => String(membership.group_id))
  );

  const courseById = new Map(learning.courses.map((course) => [String(course.id), course]));
  const lastMessageMap = await fetchLastMessageMap(groupIds);
  const serializedGroups = groups
    .map((group) => serializeGroup({
      group,
      course: courseById.get(String(group.course_id)) || group.course || null,
      memberCount: countVisibleMembersFromMemberships(group, membershipsByGroupId[String(group.id)] || []),
      isJoined: joinedGroupIds.has(String(group.id)),
      lastActivityAt: lastMessageMap.get(String(group.id)) || group.updated_at || null
    }))
    .sort((left, right) => String(left.course_name || left.title || '').localeCompare(String(right.course_name || right.title || '')));

  return {
    groups: serializedGroups,
    academicProfile: learning.academicProfile,
    resolvedProgramCategories: learning.resolvedProgramCategories,
    missingProfile: false
  };
};

const discoverStudyGroups = async ({ user, query = {} }) => {
  const limit = Math.max(1, Math.min(Number(query.limit) || DISCOVER_LIMIT, 30));

  const myCurrent = await fetchCurrentStudyGroups({ user, query: {} });

  const joined = (myCurrent.groups || []).filter((group) => group.is_joined).slice(0, limit);
  const related = (myCurrent.groups || []).filter((group) => !group.is_joined).slice(0, limit);

  const excludedIds = new Set([
    ...joined.map((group) => String(group.id)),
    ...related.map((group) => String(group.id))
  ]);

  const allWhere = { status: 'active' };
  if (excludedIds.size) {
    allWhere.id = { [Op.notIn]: Array.from(excludedIds) };
  }

  const recentGroups = await StudyGroup.findAll({
    where: allWhere,
    include: [{ model: Course, as: 'course', required: false }],
    order: [['created_at', 'DESC']],
    limit: limit * 2
  });

  // Pull a wider set so we can rank by member count for "most active"
  const popularPool = await StudyGroup.findAll({
    where: { status: 'active' },
    include: [{ model: Course, as: 'course', required: false }],
    order: [['updated_at', 'DESC']],
    limit: 80
  });

  const candidateGroupIds = new Set([
    ...recentGroups.map((g) => String(g.id)),
    ...popularPool.map((g) => String(g.id)),
    ...(myCurrent.groups || []).map((g) => String(g.id))
  ]);

  const memberships = candidateGroupIds.size
    ? await StudyGroupMember.findAll({
        where: {
          group_id: { [Op.in]: Array.from(candidateGroupIds) },
          status: 'active'
        },
        attributes: ['group_id', 'user_id', 'role']
      })
    : [];

  const membershipsByGroupId = memberships.reduce((acc, m) => {
    const key = String(m.group_id);
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});
  const joinedSet = new Set(
    memberships
      .filter((m) => String(m.user_id) === String(user?.id || ''))
      .map((m) => String(m.group_id))
  );

  const lastMessageMap = await fetchLastMessageMap(Array.from(candidateGroupIds));

  const decoratePopular = (group) => ({
    raw: group,
    serialized: serializeGroup({
      group,
      course: group.course || null,
      memberCount: countVisibleMembersFromMemberships(group, membershipsByGroupId[String(group.id)] || []),
      isJoined: joinedSet.has(String(group.id)),
      lastActivityAt: lastMessageMap.get(String(group.id)) || group.updated_at || null
    })
  });

  const popularRanked = popularPool
    .filter((group) => !excludedIds.has(String(group.id)))
    .map(decoratePopular)
    .sort((a, b) => b.serialized.member_count - a.serialized.member_count)
    .slice(0, limit)
    .map((entry) => entry.serialized);

  const popularIdSet = new Set(popularRanked.map((g) => String(g.id)));

  const recentRanked = recentGroups
    .filter((group) => !popularIdSet.has(String(group.id)) && !excludedIds.has(String(group.id)))
    .slice(0, limit)
    .map((group) => serializeGroup({
      group,
      course: group.course || null,
      memberCount: countVisibleMembersFromMemberships(group, membershipsByGroupId[String(group.id)] || []),
      isJoined: joinedSet.has(String(group.id)),
      lastActivityAt: lastMessageMap.get(String(group.id)) || group.updated_at || null
    }));

  return {
    sections: {
      joined,
      related,
      most_active: popularRanked,
      recently_added: recentRanked
    },
    academic_profile: myCurrent.academicProfile,
    missing_profile: myCurrent.missingProfile
  };
};

const joinStudyGroup = async ({ user, groupId }) => {
  const group = await StudyGroup.findByPk(groupId, {
    include: [
      {
        model: Course,
        as: 'course',
        required: false
      }
    ]
  });

  if (!group || group.status !== 'active') {
    const error = new Error('Group not found');
    error.status = 404;
    throw error;
  }

  const memberLimit = Number(group.member_limit || DEFAULT_MEMBER_LIMIT);
  if (Number.isFinite(memberLimit) && memberLimit > 0) {
    const activeCount = await StudyGroupMember.count({
      where: { group_id: group.id, status: 'active' }
    });
    if (activeCount >= memberLimit) {
      const error = new Error('This group is at full capacity right now.');
      error.status = 409;
      throw error;
    }
  }

  const [membership] = await StudyGroupMember.findOrCreate({
    where: {
      group_id: group.id,
      user_id: user.id
    },
    defaults: {
      role: 'member',
      status: 'active',
      joined_at: new Date()
    }
  });

  if (membership.status !== 'active') {
    await membership.update({
      status: 'active',
      left_at: null,
      joined_at: membership.joined_at || new Date()
    });
  }

  const memberships = await StudyGroupMember.findAll({
    where: {
      group_id: group.id,
      status: 'active'
    },
    attributes: ['user_id', 'role']
  });

  const lastMessageMap = await fetchLastMessageMap([group.id]);
  return serializeGroup({
    group,
    course: group.course || null,
    memberCount: countVisibleMembersFromMemberships(group, memberships),
    isJoined: true,
    lastActivityAt: lastMessageMap.get(String(group.id)) || group.updated_at || null
  });
};

const leaveStudyGroup = async ({ user, groupId }) => {
  const group = await StudyGroup.findByPk(groupId, {
    include: [
      {
        model: Course,
        as: 'course',
        required: false
      }
    ]
  });

  if (!group || group.status !== 'active') {
    const error = new Error('Group not found');
    error.status = 404;
    throw error;
  }

  const membership = await StudyGroupMember.findOne({
    where: {
      group_id: group.id,
      user_id: user.id,
      status: 'active'
    }
  });

  if (membership) {
    await membership.update({
      status: 'left',
      left_at: new Date()
    });
  }

  const memberships = await StudyGroupMember.findAll({
    where: {
      group_id: group.id,
      status: 'active'
    },
    attributes: ['user_id', 'role']
  });

  const lastMessageMap = await fetchLastMessageMap([group.id]);
  return serializeGroup({
    group,
    course: group.course || null,
    memberCount: countVisibleMembersFromMemberships(group, memberships),
    isJoined: false,
    lastActivityAt: lastMessageMap.get(String(group.id)) || group.updated_at || null
  });
};

const ensureActiveMember = async (userId, groupId) => {
  const membership = await StudyGroupMember.findOne({
    where: {
      group_id: groupId,
      user_id: userId,
      status: 'active'
    }
  });
  if (!membership) {
    const error = new Error('Join this study group to use the group space.');
    error.status = 403;
    throw error;
  }
  return membership;
};

const fetchStudyGroupRoom = async ({ user, groupId }) => {
  assertValidGroupId(groupId);
  const group = await StudyGroup.findByPk(groupId, {
    include: [
      {
        model: Course,
        as: 'course',
        required: false
      }
    ]
  });

  if (!group || group.status !== 'active') {
    const error = new Error('Group not found');
    error.status = 404;
    throw error;
  }

  const memberships = await StudyGroupMember.findAll({
    where: { group_id: group.id, status: 'active' },
    attributes: ['user_id', 'role'],
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'full_name', 'avatar_url', 'last_active_at']
      }
    ],
    order: [
      ['role', 'ASC'],
      ['joined_at', 'ASC']
    ]
  });

  const membership = memberships.find((m) => String(m.user_id) === String(user.id));
  const isMember = Boolean(membership);
  const visibleMembers = memberships.filter((m) => !isSyntheticOwnerMembership(group, m));
  // Room view loads messages separately; skip MAX(created_at) aggregate here to save one query per open.
  const serialized = serializeGroup({
    group,
    course: group.course || null,
    memberCount: visibleMembers.length,
    isJoined: isMember,
    lastActivityAt: group.updated_at || group.updatedAt || null
  });

  return {
    group: serialized,
    is_member: isMember,
    members: visibleMembers.map((m) => serializeRoomMember(m, user.id))
  };
};

const listStudyGroupMessages = async ({ user, groupId, before }) => {
  assertValidGroupId(groupId);
  await ensureActiveMember(user.id, groupId);

  const where = { group_id: groupId };
  if (before) {
    const cursor = await StudyGroupMessage.findByPk(before);
    if (cursor && String(cursor.group_id) === String(groupId)) {
      where.created_at = { [Op.lt]: cursor.created_at };
    }
  }

  const rows = await StudyGroupMessage.findAll({
    where,
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'full_name', 'avatar_url']
      }
    ],
    order: [['created_at', 'DESC']],
    limit: MESSAGES_PAGE_SIZE
  });

  return rows.reverse().map((row) => serializeMessage(row, row.author));
};

const postStudyGroupMessage = async ({ user, groupId, body, metadata = {} }) => {
  assertValidGroupId(groupId);
  await ensureActiveMember(user.id, groupId);

  const group = await StudyGroup.findByPk(groupId);
  if (!group || group.status !== 'active') {
    const error = new Error('Group not found');
    error.status = 404;
    throw error;
  }

  const text = String(body ?? '').replace(/\r\n/g, '\n').trim();
  const link = extractLinkFromMetadata(metadata);
  const mergedMeta = {
    ...(link ? { link } : {})
  };

  if (!text && !mergedMeta.link && !mergedMeta.voice) {
    const error = new Error('Message cannot be empty');
    error.status = 400;
    throw error;
  }

  const filtered = processMessage(text, user.id, `sg:${groupId}`);
  if (!filtered.valid) {
    const error = new Error(filtered.error);
    error.status = 400;
    throw error;
  }

  const storedBody = filtered.body || (mergedMeta.link ? `📎 ${mergedMeta.link.title}` : '🎤 Voice message');
  if (filtered.linksNeutralized) mergedMeta.linksNeutralized = true;

  const message = await StudyGroupMessage.create({
    group_id: groupId,
    user_id: user.id,
    body: storedBody,
    metadata: mergedMeta
  });

  const author = await User.findByPk(user.id, {
    attributes: ['id', 'full_name', 'avatar_url']
  });

  return serializeMessage(message, author);
};

const postStudyGroupVoiceMessage = async ({ user, groupId, fileUrl, mimeType, caption }) => {
  assertValidGroupId(groupId);
  await ensureActiveMember(user.id, groupId);

  if (!fileUrl) {
    const error = new Error('Missing audio file');
    error.status = 400;
    throw error;
  }

  const text = String(caption ?? '').trim().slice(0, 500);
  const body = text || '🎤 Voice message';
  const metadata = {
    voice: {
      url: fileUrl,
      mime_type: mimeType || 'audio/webm'
    }
  };

  const message = await StudyGroupMessage.create({
    group_id: groupId,
    user_id: user.id,
    body,
    metadata
  });

  const author = await User.findByPk(user.id, {
    attributes: ['id', 'full_name', 'avatar_url']
  });

  return serializeMessage(message, author);
};

const postStudyGroupFileMessage = async ({ user, groupId, fileUrl, fileName, mimeType, fileSize, caption }) => {
  assertValidGroupId(groupId);
  await ensureActiveMember(user.id, groupId);

  if (!fileUrl) {
    const error = new Error('Missing file');
    error.status = 400;
    throw error;
  }

  const text = String(caption ?? '').trim().slice(0, 500);
  const body = text || `📎 ${fileName || 'Attachment'}`;
  const metadata = {
    file: {
      url: fileUrl,
      name: fileName || 'attachment',
      mime_type: mimeType || 'application/octet-stream',
      size: fileSize || 0
    }
  };

  const message = await StudyGroupMessage.create({
    group_id: groupId,
    user_id: user.id,
    body,
    metadata
  });

  const author = await User.findByPk(user.id, {
    attributes: ['id', 'full_name', 'avatar_url']
  });

  return serializeMessage(message, author);
};

module.exports = {
  fetchCurrentStudyGroups,
  discoverStudyGroups,
  joinStudyGroup,
  leaveStudyGroup,
  fetchStudyGroupRoom,
  listStudyGroupMessages,
  postStudyGroupMessage,
  postStudyGroupVoiceMessage,
  postStudyGroupFileMessage
};
