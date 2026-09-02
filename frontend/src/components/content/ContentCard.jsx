import { useState, memo } from "react";
import {
  FiFileText,
  FiVideo,
  FiHelpCircle,
  FiArchive,
  FiBookOpen,
  FiCalendar,
  FiClock,
  FiUser,
  FiEye,
  FiMessageSquare,
  FiStar,
  FiHeart,
  FiBookmark,
  FiLock
} from "react-icons/fi";
import { useAuth } from "../../hooks/useAuth";
import { useSubscription } from "../../hooks/useSubscription";
import { useAnalytics } from "../../hooks/useAnalytics";
import contentService from "../../services/contentService";
import "./ContentCard.css";

function ContentCard({
  content,
  onView,
  onClick,
  onSaveToggle,
  onLikeToggle,
  primaryActionLabel,
  onPrimaryAction,
  primaryActionDisabled = false
}) {
  const { isAuthenticated } = useAuth();
  const { hasFeature } = useSubscription();
  const { trackContentInteraction } = useAnalytics();

  const [isLiked, setIsLiked] = useState(content.user_interactions?.liked || content.is_liked || content.liked || false);
  const [isSaved, setIsSaved] = useState(content.user_interactions?.saved || content.is_saved || content.saved || false);

  const getContentIcon = () => {
    switch (content.type) {
      case "text_lesson":
        return <FiFileText />;
      case "video":
        return <FiVideo />;
      case "quiz":
        return <FiHelpCircle />;
      case "past_question":
        return <FiArchive />;
      case "edutainment":
        return <FiBookOpen />;
      case "quote":
        return <FiMessageSquare />;
      default:
        return <FiFileText />;
    }
  };

  const getAccessBadge = () => {
    if (!content.is_premium) return null;

    const hasAccess = isAuthenticated &&
      (hasFeature("premium_content") ||
       (content.depth_level === "basic" && hasFeature("text_lessons")));

    return hasAccess ? null : (
      <span className="access-badge premium">Premium</span>
    );
  };

  const getDepthBadge = () => {
    switch (content.depth_level) {
      case "enhanced":
        return <span className="depth-badge enhanced">Enhanced</span>;
      case "advanced":
        return <span className="depth-badge advanced">Advanced</span>;
      default:
        return null;
    }
  };

  const handleLike = async (e) => {
    e.stopPropagation();

    if (!isAuthenticated) {
      window.dispatchEvent(new CustomEvent("openAuthModal", { detail: "login" }));
      return;
    }

    const nextState = !isLiked;
    setIsLiked(nextState);
    trackContentInteraction(content.id, "like", { liked: nextState });
    onLikeToggle?.(content, nextState);
    try {
      await contentService.likeContent(content.id);
    } catch (error) {
      console.error("Failed to like content:", error);
      setIsLiked(!nextState);
    }
  };

  const handleSave = async (e) => {
    e.stopPropagation();

    if (!isAuthenticated) {
      window.dispatchEvent(new CustomEvent("openAuthModal", { detail: "login" }));
      return;
    }

    const nextState = !isSaved;
    setIsSaved(nextState);
    trackContentInteraction(content.id, "save", { saved: nextState });
    onSaveToggle?.(content, nextState);
    try {
      await contentService.saveContent(content.id);
    } catch (error) {
      console.error("Failed to save content:", error);
      setIsSaved(!nextState);
    }
  };

  const handleView = () => {
    trackContentInteraction(content.id, "view", { from: "card" });
    if (onClick) {
      onClick(content);
    }
    if (onView) {
      onView(content);
    }
  };

  const canAccess = !content.is_premium ||
    (isAuthenticated && (
      hasFeature("premium_content") ||
      (content.depth_level === "basic" && hasFeature("text_lessons"))
    ));

  const typeLabel = (content.type || "content").replace("_", " ");

  const viewCount = content.view_count ?? content.stats?.total_views ?? 0;
  const commentCount = content.comment_count ?? 0;
  const ratingValue = content.rating ?? content.stats?.rating_avg ?? 'N/A';

  return (
    <div
      className={`content-card ${!canAccess ? "locked" : ""}`}
      onClick={canAccess ? handleView : () => window.dispatchEvent(new CustomEvent("openUpgradeModal"))}
    >
      {!canAccess && (
        <div className="locked-overlay">
          <FiLock />
          <span>Chip in to unlock</span>
        </div>
      )}

      <div className="card-header">
        <div className="content-type">
          <span className="type-icon">{getContentIcon()}</span>
          <span className="type-label">{typeLabel}</span>
        </div>
        <div className="card-badges">
          {getAccessBadge()}
          {getDepthBadge()}
        </div>
      </div>

      <div className="card-content">
        <h3 className="content-title">{content.title}</h3>
        <p className="content-description">{content.description}</p>

        <div className="content-meta">
          <span className="meta-item">
            <span className="meta-icon"><FiUser /></span>
            {content.creator_name || content.creator?.full_name || "Sharether"}
          </span>
          <span className="meta-item">
            <span className="meta-icon"><FiCalendar /></span>
            {new Date(content.created_at).toLocaleDateString()}
          </span>
          {content.duration && (
            <span className="meta-item">
              <span className="meta-icon"><FiClock /></span>
              {content.duration}
            </span>
          )}
        </div>
      </div>

      <div className="card-footer">
        <div className="stats">
          <span className="stat">
            <span className="stat-icon"><FiEye /></span>
            {viewCount}
          </span>
          <span className="stat">
            <span className="stat-icon"><FiMessageSquare /></span>
            {commentCount}
          </span>
          <span className="stat">
            <span className="stat-icon"><FiStar /></span>
            {ratingValue}
          </span>
        </div>

        <div className="actions">
          {primaryActionLabel && (
            <button
              className="primary-action"
              onClick={(e) => {
                e.stopPropagation();
                if (primaryActionDisabled) return;
                onPrimaryAction?.(content);
              }}
              type="button"
              disabled={primaryActionDisabled}
            >
              {primaryActionLabel}
            </button>
          )}
          <button
            className={`action-button ${isLiked ? "liked" : ""}`}
            onClick={handleLike}
            aria-label={isLiked ? "Unlike" : "Like"}
            aria-pressed={isLiked}
            type="button"
          >
            <FiHeart />
          </button>
          <button
            className={`action-button ${isSaved ? "saved" : ""}`}
            onClick={handleSave}
            aria-label={isSaved ? "Unsave" : "Save"}
            aria-pressed={isSaved}
            type="button"
          >
            <FiBookmark />
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(ContentCard);
