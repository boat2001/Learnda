const { Op } = require('sequelize');
const { User, TextItem } = require('../models');
const { loadDataset } = require('../scripts/edutainment_collector');

const SUBTYPES = { quotes: 'quote', facts: 'fact', jokes: 'jocular', stories: 'story', articles: 'article' };

async function syncCollected(categories = Object.keys(SUBTYPES)) {
  const [systemUser] = await User.findOrCreate({
    where: { email: 'system@learnda.app' },
    defaults: {
      full_name: 'Learnda System', password_hash: `collector-${Date.now()}`,
      role: 'admin', account_status: 'active'
    }
  });
  let inserted = 0;
  let updated = 0;
  let archived = 0;
  for (const category of categories) {
    const entries = loadDataset(category).entries || [];
    const slugs = entries.map((item) => `collected-${category}-${item.id.slice(0, 24)}`);
    const existing = slugs.length ? await TextItem.findAll({
      where: { slug: { [Op.in]: slugs } }, attributes: ['id', 'slug', 'body'], raw: true
    }) : [];
    const known = new Map(existing.map((item) => [item.slug, item]));
    const rows = entries.map((item, index) => {
      const slug = slugs[index];
      const wordCount = item.body.split(/\s+/).filter(Boolean).length;
      return {
        subtype: SUBTYPES[category], title: item.title, description: item.summary, body: item.body,
        author: String(item.author || item.sourceName || 'Learnda').slice(0, 200),
        category, tone: SUBTYPES[category], slug,
        creator_id: systemUser.id, status: 'published', is_premium: false, depth_level: 'basic',
        tags: [...new Set([category, 'edutainment', 'collected', ...(item.tags || [])])],
        word_count: wordCount, reading_time: Math.max(1, Math.ceil(wordCount / 200)),
        metadata: {
          ...(item.metadata || {}),
          source_kind: 'edutainment_collector', collector_id: item.id, source_name: item.sourceName,
          source_url: item.sourceUrl, license: item.license, featured_image: item.imageUrl,
          full_author: item.author || null,
          collected_at: item.collectedAt
        },
        published_at: item.collectedAt || new Date()
      };
    });
    const newRows = rows.filter((row) => !known.has(row.slug));
    if (newRows.length) {
      await TextItem.bulkCreate(newRows, { validate: true });
      inserted += newRows.length;
    }
    const changedRows = rows.filter((row) => known.has(row.slug) && known.get(row.slug).body !== row.body);
    for (let offset = 0; offset < changedRows.length; offset += 50) {
      await Promise.all(changedRows.slice(offset, offset + 50).map((row) => TextItem.update(row, {
        where: { id: known.get(row.slug).id }
      })));
    }
    updated += changedRows.length;
    const [archivedCount] = await TextItem.update({ status: 'archived' }, {
      where: {
        slug: { [Op.like]: `collected-${category}-%`, ...(slugs.length ? { [Op.notIn]: slugs } : {}) },
        status: 'published'
      }
    });
    archived += archivedCount;
  }
  return { inserted, updated, archived };
}

module.exports = { syncCollected };
