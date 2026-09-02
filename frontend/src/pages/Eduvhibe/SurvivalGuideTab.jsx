import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { useUser } from './UserContext';
import SearchBar from './SearchBar';
import MomentsViewer from '../Home/MomentsViewer';
import './Eduvhibe.css';

const emptyGuide = {
  title: '',
  author: '',
  category: 'Academic',
  image_url: '',
  content: '',
  read_time: '3 min read'
};

export default function SurvivalGuideTab() {
  const { isAdmin, session, lastReadArticle, setLastReadArticle } = useUser();
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerInitialId, setViewerInitialId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newGuide, setNewGuide] = useState(emptyGuide);

  const momentItems = useMemo(
    () => guides.map((g) => ({ ...g, contentId: g.id, body: g.content })),
    [guides]
  );

  const itemsPerPage = 6;
  const filterOptions = [
    { value: 'all', label: 'All Topics' },
    { value: 'Academic', label: 'Academic' },
    { value: 'Lifestyle', label: 'Lifestyle' },
    { value: 'Campus Hacks', label: 'Campus Hacks' },
    { value: 'Career', label: 'Career' },
    { value: 'Tech', label: 'Tech' }
  ];

  const fetchGuides = async () => {
    setLoading(true);
    try {
      const response = await api.eduvhibe.getGuides();
      setGuides(response?.guides || []);
    } catch (error) {
      console.error('Error fetching guides:', error);
      setGuides([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuides();
  }, []);

  useEffect(() => {
    if (!lastReadArticle || !guides.length) return;
    const exists = guides.some((g) => String(g.id) === String(lastReadArticle));
    if (exists) {
      setViewerInitialId(lastReadArticle);
      setViewerOpen(true);
    }
  }, [guides, lastReadArticle]);

  const openGuide = (guide) => {
    setLastReadArticle(String(guide.id));
    setViewerInitialId(String(guide.id));
    setViewerOpen(true);
  };

  const handlePublish = async (event) => {
    event.preventDefault();
    if (!isAdmin) return;

    setUploading(true);
    try {
      const response = await api.eduvhibe.createGuide({
        ...newGuide,
        author: newGuide.author || 'Eduvhibe Team'
      });

      if (response?.guide) {
        setGuides((prev) => [response.guide, ...prev]);
      } else {
        await fetchGuides();
      }

      alert('Article Published!');
      setShowForm(false);
      setNewGuide(emptyGuide);
    } catch (error) {
      console.error('Publish failed:', error);
      alert('Failed to publish.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (event, id) => {
    event.stopPropagation();
    if (!window.confirm('Delete this article?')) return;

    try {
      await api.eduvhibe.deleteGuide(id);
      setGuides((prev) => prev.filter((guide) => guide.id !== id));
      if (viewerInitialId === id) {
        setViewerOpen(false);
        setViewerInitialId(null);
        setLastReadArticle(null);
      }
    } catch (error) {
      console.error('Delete guide failed:', error);
      alert('Failed to delete guide.');
    }
  };

  const filteredGuides = guides.filter((guide) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      guide.title?.toLowerCase().includes(searchLower) ||
      guide.content?.toLowerCase().includes(searchLower);
    const matchesCategory = selectedFilter === 'all' || guide.category === selectedFilter;
    return matchesSearch && matchesCategory;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredGuides.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredGuides.length / itemsPerPage);

  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="guides-container edu-section-shell eduvhibe-section eduvhibe-guides-tab">
      <div className="edu-section-head eduvhibe-section-head">
        <div className="eduvhibe-section-copy">
          <h2 className="eduvhibe-section-title">Survival Guides</h2>
          <p className="eduvhibe-section-subtitle">Tips, tricks, and hacks for campus life.</p>
        </div>

        {isAdmin ? (
          <button
            className="edu-section-action"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Cancel Editor' : '+ Write Article'}
          </button>
        ) : null}
      </div>

      <SearchBar
        placeholder="Search guides by title or content..."
        onSearch={(value) => { setSearchQuery(value); setCurrentPage(1); }}
        onFilter={(value) => { setSelectedFilter(value); setCurrentPage(1); }}
        filterOptions={filterOptions}
      />

      {isAdmin && showForm ? (
        <div className="cgpa-card eduvhibe-admin-panel">
          <h3 className="eduvhibe-admin-title">Write a New Guide</h3>
          <p className="eduvhibe-admin-hint">
            <strong>Markdown Supported:</strong> Use <code># Header</code>, <code>**bold**</code>, <code>* bullet points</code>, and <code>&gt; quotes</code>.
          </p>
          <form onSubmit={handlePublish} className="eduvhibe-admin-form">
            <div className="eduvhibe-form-row">
              <input
                type="text"
                placeholder="Article Title"
                required
                className="cgpa-input eduvhibe-form-wide"
                value={newGuide.title}
                onChange={(event) => setNewGuide((prev) => ({ ...prev, title: event.target.value }))}
              />

              <input
                type="text"
                placeholder="Author (e.g. Don Chris)"
                className="cgpa-input"
                value={newGuide.author}
                onChange={(event) => setNewGuide((prev) => ({ ...prev, author: event.target.value }))}
              />
            </div>

            <div className="eduvhibe-form-row">
              <select
                className="cgpa-input"
                value={newGuide.category}
                onChange={(event) => setNewGuide((prev) => ({ ...prev, category: event.target.value }))}
              >
                <option value="Academic">Academic</option>
                <option value="Lifestyle">Lifestyle</option>
                <option value="Campus Hacks">Campus Hacks</option>
                <option value="Career">Career</option>
                <option value="Tech">Tech</option>
              </select>
              <input
                type="text"
                placeholder="Read time (e.g. 4 min read)"
                className="cgpa-input"
                value={newGuide.read_time}
                onChange={(event) => setNewGuide((prev) => ({ ...prev, read_time: event.target.value }))}
              />
            </div>

            <input
              type="text"
              placeholder="Cover image URL (optional)"
              className="cgpa-input"
              value={newGuide.image_url}
              onChange={(event) => setNewGuide((prev) => ({ ...prev, image_url: event.target.value }))}
            />

            <textarea
              placeholder="Write your guide content here..."
              required
              className="cgpa-input"
              rows={14}
              value={newGuide.content}
              onChange={(event) => setNewGuide((prev) => ({ ...prev, content: event.target.value }))}
            />

            <button
              type="submit"
              disabled={uploading}
              className="eduvhibe-submit-btn"
            >
              {uploading ? 'Publishing...' : 'Publish Guide'}
            </button>
          </form>
        </div>
      ) : null}

      {loading ? (
        <div className="eduvhibe-state-message">Loading guides...</div>
      ) : filteredGuides.length === 0 ? (
        <div className="eduvhibe-empty-state">
          <h3>No guides found.</h3>
        </div>
      ) : (
        <>
          <div className="eduvhibe-card-grid eduvhibe-guides-grid">
            {currentItems.map((guide) => (
              <article
                key={guide.id}
                className="cgpa-card eduvhibe-guide-card"
                onClick={() => openGuide(guide)}
              >
                {guide.image_url ? (
                  <img src={guide.image_url} alt={guide.title} className="article-hero-img" loading="lazy" decoding="async" />
                ) : null}

                <div className="eduvhibe-guide-card-body">
                  <div className="eduvhibe-resource-card-top">
                    <span className="guide-category-badge">{guide.category}</span>
                    {isAdmin ? (
                      <button className="eduvhibe-inline-action" type="button" onClick={(event) => handleDelete(event, guide.id)}>
                        Delete
                      </button>
                    ) : null}
                  </div>
                  <h3 className="eduvhibe-resource-title">{guide.title}</h3>
                  <p className="eduvhibe-resource-description">
                    {(guide.content || '').slice(0, 180)}...
                  </p>
                  <div className="eduvhibe-guide-footer">
                    <span>{guide.author}</span>
                    <span>{guide.read_time}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="pagination-container">
              <button className="page-btn nav-btn" onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1}>
                Previous
              </button>

              {[...Array(totalPages)].map((_, index) => (
                <button
                  key={index + 1}
                  className={`page-btn ${currentPage === index + 1 ? 'active-page' : ''}`}
                  onClick={() => paginate(index + 1)}
                >
                  {index + 1}
                </button>
              ))}

              <button className="page-btn nav-btn" onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages}>
                Next
              </button>
            </div>
          ) : null}
        </>
      )}

      <MomentsViewer
        open={viewerOpen}
        initialType="article"
        initialItemId={viewerInitialId}
        itemsByType={{ article: momentItems }}
        onClose={() => { setViewerOpen(false); setViewerInitialId(null); }}
        onMarkConsumed={() => {}}
        currentUser={session?.user || null}
      />
    </div>
  );
}
