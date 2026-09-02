import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useContent } from '../../hooks/useContent';
import usePageTitle from '../../hooks/usePageTitle';
import { consumeGuestContentView, buildGuestLimitMessage } from '../../utils/guestContentAccess';
import { sanitizeLessonHtml } from '../../utils/sanitizeHtml';
import './Blog.css';

const getPostCategory = (post) => post.category || post.metadata?.category || post.tags?.[0] || 'General';

export default function PostDetail() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { trackEvent } = useAnalytics();
  const { fetchContentById, likeContent, saveContent, addComment, getComments, getContentList } = useContent();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [relatedPosts, setRelatedPosts] = useState([]);
  const [guestAccessBlocked, setGuestAccessBlocked] = useState(null);
  usePageTitle(post?.title || 'Blog Post');

  useEffect(() => {
    loadPost();
  }, [postId, isAuthenticated]);

  const loadPost = async () => {
    setLoading(true);
    setGuestAccessBlocked(null);
    try {
      const postData = await fetchContentById(postId);
      if (postData && postData.type === 'blog') {
        const guestAccess = consumeGuestContentView({
          isAuthenticated,
          contentType: postData.type,
          contentId: postData.id || postId
        });

        if (!guestAccess.allowed) {
          setPost(null);
          setComments([]);
          setRelatedPosts([]);
          setGuestAccessBlocked({
            title: `Daily ${guestAccess.typeLabel} limit reached`,
            message: buildGuestLimitMessage(guestAccess.typeLabel)
          });
          window.dispatchEvent(new CustomEvent('openAuthModal', { detail: 'register' }));
          return;
        }

        setPost(postData);
        trackEvent('blog_post_viewed', { post_id: postId });

        const postComments = await getComments(postId);
        setComments(postComments);

        await loadRelatedPosts(postData.tags || []);
      } else {
        navigate('/blog');
      }
    } catch (error) {
      console.error('Error loading post:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRelatedPosts = async (tags) => {
    if (!tags.length) {
      setRelatedPosts([]);
      return;
    }
    try {
      const response = await getContentList({ type: 'blog', tags: tags.join(',') });
      const items = response.data || [];
      setRelatedPosts(items.filter((item) => String(item.id) !== String(postId)).slice(0, 3));
    } catch (error) {
      console.error('Error loading related posts:', error);
      setRelatedPosts([]);
    }
  };

  const handleLike = async () => {
    if (!isAuthenticated) {
      window.dispatchEvent(new CustomEvent('openAuthModal', { detail: 'login' }));
      return;
    }

    try {
      await likeContent(postId);
      setPost((prev) => {
        const liked = !prev.user_interactions?.liked;
        const likeCount = (prev.stats?.like_count || 0) + (liked ? 1 : -1);
        return {
          ...prev,
          stats: { ...prev.stats, like_count: Math.max(likeCount, 0) },
          user_interactions: {
            ...prev.user_interactions,
            liked,
          },
        };
      });
      trackEvent('blog_post_liked', { post_id: postId });
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleSave = async () => {
    if (!isAuthenticated) {
      window.dispatchEvent(new CustomEvent('openAuthModal', { detail: 'login' }));
      return;
    }

    try {
      await saveContent(postId);
      setPost((prev) => ({
        ...prev,
        user_interactions: {
          ...prev.user_interactions,
          saved: !prev.user_interactions?.saved,
        },
      }));
      trackEvent('blog_post_saved', { post_id: postId });
    } catch (error) {
      console.error('Error saving post:', error);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    if (!isAuthenticated) {
      window.dispatchEvent(new CustomEvent('openAuthModal', { detail: 'login' }));
      return;
    }

    setSubmittingComment(true);
    try {
      const newComment = await addComment(postId, commentText);
      if (newComment) {
        setComments((prev) => [newComment, ...prev]);
        setCommentText('');
        trackEvent('blog_comment_added', { post_id: postId });
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setSubmittingComment(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const renderComments = () => (
    <div className="comments-section">
      <h3>Comments ({comments.length})</h3>

      <form onSubmit={handleCommentSubmit} className="comment-form">
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Share your thoughts..."
          rows="3"
          disabled={submittingComment}
        />
        <div className="comment-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!commentText.trim() || submittingComment}
          >
            {submittingComment ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
      </form>

      <div className="comments-list">
        {comments.length === 0 ? (
          <p className="no-comments">No comments yet. Be the first to comment!</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="comment-item">
              <div className="comment-author">
                <div className="author-avatar">
                  {comment.author_avatar ? (
                    <img src={comment.author_avatar} alt={comment.author_name} loading="lazy" decoding="async" />
                  ) : (
                    <div className="avatar-fallback">
                      {comment.author_name?.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="author-info">
                  <strong>{comment.author_name}</strong>
                  <span className="comment-time">
                    {formatDate(comment.created_at)}
                  </span>
                </div>
              </div>
              <div className="comment-content">
                <p>{comment.content}</p>
              </div>
              <div className="comment-actions">
                <button className="like-btn" type="button">
                  Like {comment.likes || 0}
                </button>
                <button className="reply-btn" type="button">
                  Reply
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderRelatedPosts = () => {
    if (relatedPosts.length === 0) return null;

    return (
      <div className="related-posts">
        <h3>Related Posts</h3>
        <div className="related-grid">
          {relatedPosts.map((relatedPost) => (
            <div
              key={relatedPost.id}
              className="related-post-card"
              onClick={() => navigate(`/blog/post/${relatedPost.id}`)}
            >
              <div className="related-thumbnail">
                {relatedPost.thumbnail_url ? (
                  <img src={relatedPost.thumbnail_url} alt={relatedPost.title} loading="lazy" decoding="async" />
                ) : (
                  <div className="thumbnail-placeholder">Post</div>
                )}
              </div>
              <div className="related-content">
                <h4>{relatedPost.title}</h4>
                <p className="related-excerpt">
                  {(relatedPost.description || '').substring(0, 100)}...
                </p>
                <div className="related-meta">
                  <span>{formatDate(relatedPost.created_at)}</span>
                  <span> | </span>
                  <span>{relatedPost.read_time || '5'} min read</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="post-loading">
        <div className="spinner"></div>
        <p>Loading post...</p>
      </div>
    );
  }

  if (!post) {
    if (guestAccessBlocked) {
      return (
        <div className="post-gate">
          <div className="post-gate-card">
            <h2>{guestAccessBlocked.title}</h2>
            <p>{guestAccessBlocked.message}</p>
            <div className="post-gate-actions">
              <button
                className="btn btn-primary"
                onClick={() => window.dispatchEvent(new CustomEvent('openAuthModal', { detail: 'register' }))}
                type="button"
              >
                Sign up for more
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => navigate('/blog')}
                type="button"
              >
                Back to Blog
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="post-not-found">
        <h2>Post Not Found</h2>
        <p>The blog post you are looking for does not exist or has been removed.</p>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/blog')}
        >
          Back to Blog
        </button>
      </div>
    );
  }

  return (
    <div className="post-detail">
      <article className="post-content">
        <header className="post-header">
          <div className="post-meta">
            <span className="post-category">{getPostCategory(post)}</span>
            <span className="post-date">{formatDate(post.created_at)}</span>
            <span className="post-read-time">{post.read_time || post.reading_time || '5'} min read</span>
          </div>

          <h1 className="post-title">{post.title}</h1>

          <div className="post-author">
            <div className="author-avatar">
              {post.author_avatar ? (
                <img src={post.author_avatar} alt={post.author_name} loading="lazy" decoding="async" />
              ) : (
                <div className="avatar-fallback">
                  {post.author_name?.charAt(0)}
                </div>
              )}
            </div>
            <div className="author-info">
              <strong>{post.author_name || 'Learnda'}</strong>
              <span>{post.author_title || 'Creator'}</span>
            </div>
          </div>
        </header>

        {post.featured_image && (
          <div className="post-featured-image">
            <img src={post.featured_image} alt={post.title} loading="lazy" decoding="async" />
          </div>
        )}

        <div className="post-body">
          {post.content ? (
            <div dangerouslySetInnerHTML={{ __html: sanitizeLessonHtml(post.content) }} />
          ) : (
            <p>No content available.</p>
          )}
        </div>

        <div className="post-tags">
          {post.tags?.map((tag) => (
            <span key={tag} className="tag">
              #{tag}
            </span>
          ))}
        </div>

        <div className="post-actions">
          <div className="action-left">
            <button
              className={`like-btn ${post.user_interactions?.liked ? 'liked' : ''}`}
              onClick={handleLike}
              type="button"
            >
              {post.user_interactions?.liked ? 'Liked' : 'Like'}
              <span className="count">{post.stats?.like_count || 0}</span>
            </button>

            <button
              className={`save-btn ${post.user_interactions?.saved ? 'saved' : ''}`}
              onClick={handleSave}
              type="button"
            >
              {post.user_interactions?.saved ? 'Saved' : 'Save'}
            </button>
          </div>

          <div className="action-right">
            <button className="share-btn" type="button">
              Share
            </button>
          </div>
        </div>

        <div className="post-stats">
          <div className="stat-item">
            <span className="stat-label">Views</span>
            <span className="stat-value">{post.view_count || post.stats?.total_views || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Likes</span>
            <span className="stat-value">{post.stats?.like_count || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Comments</span>
            <span className="stat-value">{comments.length}</span>
          </div>
        </div>
      </article>

      <div className="post-sidebar">
        {renderComments()}
        {renderRelatedPosts()}
      </div>
    </div>
  );
}
