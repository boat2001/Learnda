const { Op } = require('sequelize');
const db = require('../models');
const { User } = db;

// Blog posts and guides live in the text_items table
const BLOG_SUBTYPES = ['blog_post', 'guide'];

const buildExcerpt = (text, limit = 160) => {
  if (!text) return '';
  const normalized = text.replace(/<[^>]*>/g, '').trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit)}...`;
};

class BlogController {
  async related(req, res) {
    try {
      const tagsParam = (req.query.tags || '').trim();
      const tags = tagsParam ? tagsParam.split(',').map((t) => t.trim()).filter(Boolean) : [];

      const where = {
        subtype: { [Op.in]: BLOG_SUBTYPES },
        status: 'published'
      };
      if (tags.length) {
        where.tags = { [Op.overlap]: tags };
      }

      const posts = await db.TextItem.findAll({
        where,
        include: [{ model: User, as: 'creator', attributes: ['id', 'full_name', 'avatar_url'] }],
        order: [['created_at', 'DESC']],
        limit: 4
      });

      const formatted = posts.map((post) => {
        const contentBody = post.body || post.metadata?.body || post.description || '';
        return {
          id: post.id,
          title: post.title,
          excerpt: buildExcerpt(contentBody),
          thumbnail_url: post.thumbnail_url || null,
          created_at: post.created_at,
          read_time: post.metadata?.read_time || post.reading_time || null,
          tags: post.tags || []
        };
      });

      res.json({ success: true, posts: formatted });
    } catch (error) {
      console.error('Related blog posts error:', error);
      res.status(500).json({ success: false, error: 'Failed to load related posts' });
    }
  }
}

module.exports = new BlogController();
