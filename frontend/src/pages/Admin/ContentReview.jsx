import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useAnalytics } from '../../hooks/useAnalytics';
import api from '../../services/api';
import { sanitizeLessonHtml } from '../../utils/sanitizeHtml';
import './Admin.css';

export default function ContentReview() {
  const { user, isAuthenticated } = useAuth();
  const { trackEvent } = useAnalytics();
  
  const [pendingContent, setPendingContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    type: 'all',
    status: 'pending',
    dateRange: 'all',
  });
  const [selectedContent, setSelectedContent] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');

  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      loadPendingContent();
    }
  }, [isAuthenticated, user, filters]);

  const loadPendingContent = async () => {
    setLoading(true);
    try {
      const data = await api.admin.getPendingContent(filters);
      if (data?.success) {
        setPendingContent(data.content || []);
        trackEvent('content_review_loaded', {
          count: data.content?.length || 0,
          filters,
        });
      }
    } catch (error) {
      console.error('Error loading pending content:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleContentSelect = (content) => {
    setSelectedContent(content);
    trackEvent('content_review_select', { content_id: content.id });
  };

  const handleApprove = async (contentId, withChanges = false) => {
    try {
      const data = await api.admin.reviewContent(contentId, {
        action: 'approve',
        notes: reviewNotes,
        requires_changes: withChanges,
      });

      if (data?.success) {
        // Remove from pending list
        setPendingContent(prev => prev.filter(c => c.id !== contentId));
        setSelectedContent(null);
        setReviewNotes('');
        
        trackEvent('content_approved', {
          content_id: contentId,
          with_changes: withChanges,
        });
      }
    } catch (error) {
      console.error('Error approving content:', error);
    }
  };

  const handleReject = async (contentId, reason) => {
    try {
      const data = await api.admin.reviewContent(contentId, {
        action: 'reject',
        notes: reason,
      });

      if (data?.success) {
        setPendingContent(prev => prev.filter(c => c.id !== contentId));
        setSelectedContent(null);
        setReviewNotes('');
        
        trackEvent('content_rejected', {
          content_id: contentId,
          reason,
        });
      }
    } catch (error) {
      console.error('Error rejecting content:', error);
    }
  };

  const renderContentPreview = () => {
    if (!selectedContent) return null;

    return (
      <div className="content-preview">
        <div className="preview-header">
          <h3>Review Content</h3>
          <button 
            className="close-preview"
            onClick={() => setSelectedContent(null)}
          >
            ×
          </button>
        </div>

        <div className="preview-content">
          <div className="content-meta">
            <h4>{selectedContent.title}</h4>
            <div className="meta-tags">
              <span className="tag type">{selectedContent.type}</span>
              <span className="tag depth">{selectedContent.depth_level}</span>
              <span className="tag visual">{selectedContent.visual_type}</span>
              {selectedContent.is_premium && (
                <span className="tag premium">Premium</span>
              )}
            </div>
            
            <div className="creator-info">
              <p><strong>Creator:</strong> {selectedContent.creator_name}</p>
              <p><strong>Submitted:</strong> {new Date(selectedContent.created_at).toLocaleDateString()}</p>
              <p><strong>Revenue Share:</strong> {selectedContent.revenue_share}%</p>
            </div>
          </div>

          <div className="content-body">
            <h5>Description</h5>
            <p>{selectedContent.description}</p>

            {selectedContent.content && (
              <div className="content-view">
                <div dangerouslySetInnerHTML={{ __html: sanitizeLessonHtml(selectedContent.content) }} />
              </div>
            )}

            {selectedContent.file_url && (
              <div className="file-preview">
                <h5>Attached File</h5>
                <a 
                  href={selectedContent.file_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="file-link"
                >
                  📎 {selectedContent.file_name || 'Download file'}
                </a>
              </div>
            )}
          </div>

          <div className="review-notes">
            <h5>Review Notes</h5>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Add review notes here..."
              rows="4"
            />
          </div>

          <div className="review-actions">
            <button 
              className="btn btn-success"
              onClick={() => handleApprove(selectedContent.id, false)}
            >
              ✅ Approve & Publish
            </button>
            <button 
              className="btn btn-warning"
              onClick={() => handleApprove(selectedContent.id, true)}
            >
              🔧 Approve with Changes
            </button>
            <button 
              className="btn btn-danger"
              onClick={() => {
                const reason = prompt('Enter rejection reason:');
                if (reason) handleReject(selectedContent.id, reason);
              }}
            >
              ❌ Reject
            </button>
            <button 
              className="btn btn-secondary"
              onClick={() => setSelectedContent(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderContentList = () => {
    if (loading) {
      return (
        <div className="loading-content">
          <div className="spinner"></div>
          <p>Loading content for review...</p>
        </div>
      );
    }

    if (pendingContent.length === 0) {
      return (
        <div className="no-pending-content">
          <div className="empty-icon">✅</div>
          <h3>All caught up!</h3>
          <p>No pending content to review at the moment.</p>
        </div>
      );
    }

    return (
      <div className="content-list">
        <table className="content-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Creator</th>
              <th>Submitted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pendingContent.map(content => (
              <tr key={content.id}>
                <td>
                  <strong>{content.title}</strong>
                  <div className="content-excerpt">{content.description?.substring(0, 100)}...</div>
                </td>
                <td>
                  <span className="type-badge">{content.type}</span>
                </td>
                <td>{content.creator_name}</td>
                <td>{new Date(content.created_at).toLocaleDateString()}</td>
                <td>
                  <button 
                    className="btn btn-sm btn-primary"
                    onClick={() => handleContentSelect(content)}
                  >
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="content-review">
      <div className="review-header">
        <h2>Content Review</h2>
        <div className="header-stats">
          <span className="stat">
            <strong>{pendingContent.length}</strong> pending
          </span>
          <span className="stat">
            <strong>24</strong> reviewed today
          </span>
        </div>
      </div>

      <div className="review-filters">
        <div className="filter-group">
          <label>Content Type:</label>
          <select
            value={filters.type}
            onChange={(e) => setFilters({...filters, type: e.target.value})}
          >
            <option value="all">All Types</option>
            <option value="lesson">Lessons</option>
            <option value="file">Files</option>
            <option value="quiz">Quizzes</option>
            <option value="blog">Blogs & Edutainment</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Date Range:</label>
          <select
            value={filters.dateRange}
            onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>

        <button 
          className="refresh-btn"
          onClick={loadPendingContent}
        >
          ↻ Refresh
        </button>
      </div>

      <div className="review-container">
        <div className="content-list-container">
          {renderContentList()}
        </div>
        
        <div className="preview-container">
          {renderContentPreview()}
        </div>
      </div>
    </div>
  );
}
