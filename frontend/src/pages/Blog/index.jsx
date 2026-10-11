import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FiChevronRight, FiFileText, FiSearch, FiTag, FiUser } from 'react-icons/fi';
import ContentCard from '../../components/content/ContentCard';
import FormModal from '../../components/common/FormModal';
import { useContent } from '../../hooks/useContent';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useAuth } from '../../hooks/useAuth';
import api, { resolveUploadUrl } from '../../services/api';
import { playUiSound } from '../../utils/uiSounds';
import '../SharedPages.css';
import PageHeader from '../../components/common/PageHeader';
import './Blog.css';

const getCategory = (blog) => blog.category || blog.metadata?.category || blog.tags?.[0] || 'General';
const DEFAULT_TOPICS = [
  'Platform',
  'Practice',
  'Learning Space',
  'Creators',
  'Community',
  'Study Tips',
  'Resources',
  'Campus Life',
  'Product Updates',
  'Student Success',
  'Learning',
  'Exams',
];

const getDisplayName = (user) =>
  user?.full_name || user?.name ||
  [user?.first_name, user?.last_name].filter(Boolean).join(' ') || '';

export default function Blog() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [blogs, setBlogs] = useState([]);
  const [featuredBlogs, setFeaturedBlogs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '');
  const [writeModalOpen, setWriteModalOpen] = useState(false);
  const [writeSubmitting, setWriteSubmitting] = useState(false);
  const [writeStatus, setWriteStatus] = useState('');
  const [writeError, setWriteError] = useState('');
  const [writeForm, setWriteForm] = useState({
    name: '',
    email: '',
    title: '',
    topic: '',
    summary: '',
    experience: '',
  });

  const { trackEvent } = useAnalytics();
  const { getContentList } = useContent();

  useEffect(() => {
    const id = setTimeout(() => playUiSound('pageArriveBlog'), 500);
    return () => clearTimeout(id);
  }, []);

  const searchQuery = searchParams.get('q') || '';
  const authenticatedName = getDisplayName(user);
  const needsWriterName = !isAuthenticated || !authenticatedName;
  const needsWriterEmail = !isAuthenticated || !user?.email;

  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    setWriteForm((previous) => ({
      ...previous,
      name: previous.name || getDisplayName(user),
      email: previous.email || user?.email || '',
    }));
  }, [user]);

  useEffect(() => {
    loadBlogs();

    trackEvent('blog_page_view', {
      has_query: !!searchQuery,
      category: activeCategory
    });
  }, [activeCategory, searchQuery]);

  const loadBlogs = async () => {
    try {
      setLoading(true);

      const filters = { type: 'blog', status: 'published' };
      if (searchQuery) {
        filters.search = searchQuery;
      }

      const blogsData = await getContentList(filters);
      const list = blogsData.data || [];
      setBlogs(list);

      const sortedByViews = [...list].sort((a, b) => {
        const aViews = a.view_count ?? a.stats?.total_views ?? 0;
        const bViews = b.view_count ?? b.stats?.total_views ?? 0;
        return bViews - aViews;
      });
      setFeaturedBlogs(sortedByViews.slice(0, 3));

      const categoryMap = new Map();
      list.forEach((blog) => {
        const category = getCategory(blog);
        categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
      });

      DEFAULT_TOPICS.forEach((topic) => {
        if (!categoryMap.has(topic)) categoryMap.set(topic, 0);
      });

      const categoryList = Array.from(categoryMap.entries()).map(([name, count]) => ({ name, count }));
      categoryList.sort((a, b) => b.count - a.count);
      setCategories(categoryList);

    } catch (error) {
      console.error('Error loading blogs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredBlogs = useMemo(() => {
    if (activeCategory === 'all') return blogs;
    return blogs.filter((blog) => getCategory(blog) === activeCategory || (blog.tags || []).includes(activeCategory));
  }, [blogs, activeCategory]);

  const handleWriteChange = (event) => {
    const { name, value } = event.target;
    setWriteForm((previous) => ({ ...previous, [name]: value }));
  };

  const submitBlogPitch = async (event) => {
    event.preventDefault();
    setWriteSubmitting(true);
    setWriteError('');
    setWriteStatus('');

    try {
      const name = needsWriterName ? writeForm.name : authenticatedName;
      const email = needsWriterEmail ? writeForm.email : user.email;
      await api.support.submitReport({
        name,
        email,
        subject: `Blog pitch: ${writeForm.title}`,
        category: 'Blog Pitch',
        message: [
          `Topic: ${writeForm.topic}`,
          `Working title: ${writeForm.title}`,
          '',
          'Summary:',
          writeForm.summary,
          '',
          'Writing experience or notes:',
          writeForm.experience || 'Not provided',
        ].join('\n'),
      });
      setWriteStatus('Your blog idea has been sent to the Learnda team.');
      setWriteForm((previous) => ({
        ...previous,
        title: '',
        topic: '',
        summary: '',
        experience: '',
      }));
      setWriteModalOpen(false);
    } catch (error) {
      setWriteError(error?.message || 'Unable to send your blog idea right now.');
    } finally {
      setWriteSubmitting(false);
    }
  };

  const renderFeaturedSection = () => {
    if (featuredBlogs.length === 0 || searchQuery) return null;

    return (
      <section className="page-section featured-blogs">
        <div className="section-heading">
          <h2>Featured Articles</h2>
          <p>High-signal reads from the Learnda learning community.</p>
        </div>
        <div className="featured-grid">
          {featuredBlogs.map((blog, index) => (
            <div
              key={blog.id}
              className={`featured-card ${index === 0 ? 'main-featured' : ''}`}
            >
              {blog.thumbnail_url && (
                <img src={resolveUploadUrl(blog.thumbnail_url)} alt={blog.title} className="featured-image" loading="lazy" decoding="async" />
              )}

              <div className="featured-content">
                <div className="featured-meta">
                  <span className="category">{getCategory(blog)}</span>
                  <span className="separator">|</span>
                  <span className="read-time">
                    {blog.reading_time || blog.read_time || '5'} min read
                  </span>
                </div>

                <h3>{blog.title}</h3>
                <p>{blog.description}</p>

                <div className="featured-footer">
                  <div className="author">
                    {blog.creator?.avatar_url ? (
                      <img src={resolveUploadUrl(blog.creator.avatar_url)} alt={blog.creator.full_name} loading="lazy" decoding="async" />
                    ) : (
                      <span className="author-icon">
                        <FiUser />
                      </span>
                    )}
                    <span>{blog.creator?.full_name || blog.creator_name || 'Learnda'}</span>
                  </div>
                  <Link to={`/blog/post/${blog.id}`} className="read-more">
                    Read More <FiChevronRight />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  const renderCategories = () => (
    <div className="categories-section" aria-label="Blog topics">
      <div className="categories-header">
        <h3>Filter topics</h3>
        <span>{categories.length + 1} topics</span>
      </div>
      <div className="categories-grid" role="tablist">
        <button
          onClick={() => setActiveCategory('all')}
          className={`category-card ${activeCategory === 'all' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeCategory === 'all'}
        >
          <span className="category-icon"><FiFileText /></span>
          <span className="category-name">All Articles</span>
          <span className="category-count">{blogs.length}</span>
        </button>

        {categories.map((categoryItem) => (
          <button
          key={categoryItem.name}
          onClick={() => setActiveCategory(categoryItem.name)}
          className={`category-card ${activeCategory === categoryItem.name ? 'active' : ''}`}
          role="tab"
          aria-selected={activeCategory === categoryItem.name}
        >
          <span className="category-icon"><FiTag /></span>
          <span className="category-name">{categoryItem.name}</span>
            <span className="category-count">{categoryItem.count}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderBlogList = () => {
    if (filteredBlogs.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-icon"><FiFileText /></div>
          <h3>No Articles Found</h3>
          <p>
            {searchQuery
              ? `No articles found for "${searchQuery}". Try different keywords.`
              : activeCategory === 'all'
                ? 'No blog posts have been published yet.'
                : 'No published articles are available in this topic yet.'}
          </p>
          {searchQuery && (
            <button
              onClick={() => setActiveCategory('all')}
              className="clear-search-button"
            >
              Clear Search
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="blog-list">
        <div className="list-header">
          <h2>
            {searchQuery
              ? `Search Results for "${searchQuery}"`
              : activeCategory === 'all' ? 'Latest Articles' : activeCategory
            }
            <span className="article-count"> ({filteredBlogs.length})</span>
          </h2>

          <div className="sort-options">
            <select className="sort-select">
              <option value="latest">Latest</option>
              <option value="popular">Most Popular</option>
              <option value="trending">Trending</option>
            </select>
          </div>
        </div>

        <div className="articles-grid">
          {filteredBlogs.map((blog) => (
            <ContentCard
              key={blog.id}
              content={blog}
              onView={() => trackEvent('blog_card_click', { blog_id: blog.id })}
              showAuthor={true}
              showReadTime={true}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="page-shell blog-page">
      <PageHeader icon="blog" title="Learnda Blog" description="Tips, stories and news for learners and parents." />

      <form
        className="blog-hero-actions blog-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          const query = searchInput.trim();
          navigate(query ? `/blog?q=${encodeURIComponent(query)}` : '/blog');
        }}
      >
        <div className="search-bar">
          <input
            type="search"
            placeholder="Search articles..."
            value={searchInput}
            className="search-input"
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <button className="search-button" aria-label="Search" type="submit">
            <FiSearch />
          </button>
        </div>
        <button
          className="btn btn-secondary blog-contribute"
          type="button"
          onClick={() => setWriteModalOpen(true)}
        >
          Contribute
        </button>
      </form>

      {renderFeaturedSection()}

      <section className="page-section blog-container">
        <main className="blog-main">
          {renderCategories()}
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading articles...</p>
            </div>
          ) : (
            renderBlogList()
          )}
        </main>
      </section>

      <section className="page-section">
        <div className="info-card blog-cta">
          <h2>Want to Write for Us?</h2>
          <p>Send a focused blog idea for the Learnda learning community.</p>
          {writeStatus ? <p className="pricing-inline-feedback success status-inline">{writeStatus}</p> : null}
          <button type="button" className="cta-button" onClick={() => setWriteModalOpen(true)}>
            Open writer form
          </button>
        </div>
      </section>

      <FormModal
        isOpen={writeModalOpen}
        onClose={() => !writeSubmitting && setWriteModalOpen(false)}
        title="Write for Learnda"
        subtitle="Share the article idea, the student problem it solves, and the angle you want to write from."
      >
        <form onSubmit={submitBlogPitch}>
          {(needsWriterName || needsWriterEmail) ? (
            <div className="form-grid">
              {needsWriterName ? (
                <div className="form-row">
                  <label htmlFor="writer-name">Full name</label>
                  <input id="writer-name" name="name" type="text" value={writeForm.name} onChange={handleWriteChange} required />
                </div>
              ) : null}
              {needsWriterEmail ? (
                <div className="form-row">
                  <label htmlFor="writer-email">Email</label>
                  <input id="writer-email" name="email" type="email" value={writeForm.email} onChange={handleWriteChange} required />
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="form-grid">
            <div className="form-row">
              <label htmlFor="writer-title">Working title</label>
              <input id="writer-title" name="title" type="text" value={writeForm.title} onChange={handleWriteChange} required />
            </div>
            <div className="form-row">
              <label htmlFor="writer-topic">Topic</label>
              <input id="writer-topic" name="topic" type="text" value={writeForm.topic} onChange={handleWriteChange} placeholder="Study tips, campus life, exams..." required />
            </div>
          </div>
          <div className="form-row">
            <label htmlFor="writer-summary">Article idea</label>
            <textarea
              id="writer-summary"
              name="summary"
              rows="5"
              value={writeForm.summary}
              onChange={handleWriteChange}
              placeholder="What will the article help students understand or do better?"
              required
            />
          </div>
          <div className="form-row">
            <label htmlFor="writer-experience">Writing experience or notes</label>
            <textarea
              id="writer-experience"
              name="experience"
              rows="3"
              value={writeForm.experience}
              onChange={handleWriteChange}
              placeholder="Optional: links, past writing, or why you want to write this."
            />
          </div>
          {writeError ? <p className="pricing-inline-feedback error status-inline">{writeError}</p> : null}
          <div className="fm-actions">
            <button className="btn btn-primary" type="submit" disabled={writeSubmitting}>
              {writeSubmitting ? 'Sending...' : 'Send blog idea'}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => setWriteModalOpen(false)} disabled={writeSubmitting}>
              Cancel
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
}
