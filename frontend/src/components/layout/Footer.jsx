import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FaFacebookF, FaInstagram, FaTelegram, FaTiktok, FaXTwitter, FaYoutube } from "react-icons/fa6";
import {
  FiActivity,
  FiAlertCircle,
  FiArrowUp,
  FiAward,
  FiCompass,
  FiEdit,
  FiEdit3,
  FiFileText,
  FiGift,
  FiGlobe,
  FiGrid,
  FiHeart,
  FiDollarSign,
  FiInfo,
  FiMail,
  FiMessageCircle,
  FiSend,
  FiShare2,
  FiShield,
  FiStar,
  FiTrendingUp,
  FiUsers,
  FiZap,
} from "react-icons/fi";
import api from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import CommunityForumPicker from "../community/CommunityForumPicker";
import { FEATURE_FLAGS } from "../../config/featureFlags";
import "./Footer.css";

/**
 * A footer link for a feature that's temporarily dormant. Renders like a real
 * link so the section doesn't look empty, but is non-navigating: clicking opens
 * a shared "coming soon" popup (handled by the parent via onSelect).
 */
function ComingSoonItem({ icon: Icon, label, onSelect }) {
  return (
    <li>
      <button
        type="button"
        className="footer-soon-link"
        onClick={() => onSelect(label)}
        aria-label={`${label} — coming soon`}
      >
        <Icon aria-hidden /> {label}
      </button>
    </li>
  );
}

/**
 * Small centered popup shown when a dormant footer feature is tapped.
 */
function ComingSoonPopup({ feature, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="coming-soon-overlay" role="dialog" aria-modal="true" aria-label={`${feature} coming soon`} onClick={onClose}>
      <div className="coming-soon-popup" onClick={(e) => e.stopPropagation()}>
        <span className="coming-soon-popup-badge"><FiZap aria-hidden /> Coming soon</span>
        <h4 className="coming-soon-popup-title">{feature}</h4>
        <p className="coming-soon-popup-text">
          We&apos;re putting the finishing touches on {feature}. It&apos;ll be available here shortly — thanks for your patience!
        </p>
        <button type="button" className="coming-soon-popup-btn" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}

const LOGO_SRC = `${import.meta.env.BASE_URL}learnda-logo.webp`;
const LOGO_DARK_SRC = `${import.meta.env.BASE_URL}learnda-logo.webp`;
const MAX_FEEDBACK_RATING = 5;
const FEEDBACK_PLACEHOLDERS = {
  1: "What went wrong?",
  2: "What felt poor?",
  3: "What can improve?",
  4: "What did you like?",
  5: "What felt excellent?",
};

const FEEDBACK_BURSTS = {
  1: [
    { type: "star", x: 12, y: 12, delay: 0, driftX: -18, driftY: -58, scale: 0.72 },
  ],
  2: [
    { type: "star", x: 24, y: 10, delay: 0, driftX: -20, driftY: -64, scale: 0.75 },
    { type: "star", x: 58, y: 12, delay: 80, driftX: 16, driftY: -60, scale: 0.68 },
  ],
  3: [
    { type: "star", x: 24, y: 12, delay: 0, driftX: -22, driftY: -66, scale: 0.74 },
    { type: "star", x: 58, y: 8, delay: 70, driftX: 18, driftY: -68, scale: 0.72 },
    { type: "glitter", x: 40, y: 4, delay: 110, driftX: 0, driftY: -48, scale: 0.56 },
  ],
  4: [
    { type: "star", x: 18, y: 14, delay: 0, driftX: -24, driftY: -72, scale: 0.78 },
    { type: "star", x: 42, y: 6, delay: 45, driftX: -6, driftY: -78, scale: 0.74 },
    { type: "star", x: 68, y: 12, delay: 95, driftX: 22, driftY: -74, scale: 0.76 },
    { type: "glitter", x: 30, y: 2, delay: 50, driftX: -18, driftY: -52, scale: 0.58 },
    { type: "glitter", x: 56, y: 0, delay: 120, driftX: 16, driftY: -50, scale: 0.62 },
  ],
  5: [
    { type: "star", x: 8, y: 16, delay: 0, driftX: -26, driftY: -78, scale: 0.84 },
    { type: "star", x: 30, y: 6, delay: 35, driftX: -10, driftY: -86, scale: 0.82 },
    { type: "star", x: 54, y: 4, delay: 80, driftX: 8, driftY: -84, scale: 0.8 },
    { type: "star", x: 78, y: 14, delay: 120, driftX: 24, driftY: -80, scale: 0.82 },
    { type: "glitter", x: 20, y: 0, delay: 20, driftX: -22, driftY: -58, scale: 0.64 },
    { type: "glitter", x: 44, y: -2, delay: 70, driftX: 0, driftY: -60, scale: 0.7 },
    { type: "glitter", x: 68, y: 0, delay: 130, driftX: 20, driftY: -56, scale: 0.66 },
  ],
};

const getFeedbackCategory = (rating) => {
  return "Feedback";
};

const scheduleTone = (audioContext, gainNode, oscillatorType, frequency, startAt, duration, maxVolume) => {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = oscillatorType;
  oscillator.frequency.setValueAtTime(frequency, startAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(maxVolume, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain);
  gain.connect(gainNode);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
};

export default function Footer() {
  const { user, isAuthenticated } = useAuth();
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [comingSoonFeature, setComingSoonFeature] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackHover, setFeedbackHover] = useState(0);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackBurst, setFeedbackBurst] = useState({ key: 0, rating: 0 });
  const audioContextRef = useRef(null);

  const feedbackName =
    user?.full_name || user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Learnda User";
  const feedbackEmail = user?.email || "";
  const reporterName = isAuthenticated ? feedbackName : "Anonymous Guest";

  useEffect(() => {
    // Simple fixed-position button — it's allowed to rest on top of the
    // footer once scrolled that far, same as most "back to top" buttons.
    const updateBackToTop = () => {
      setShowBackToTop(window.scrollY > 300);
    };

    updateBackToTop();
    window.addEventListener("scroll", updateBackToTop);
    return () => {
      window.removeEventListener("scroll", updateBackToTop);
    };
  }, []);

  useEffect(() => {
    if (!feedbackBurst.rating) return undefined;

    const timeoutId = window.setTimeout(() => {
      setFeedbackBurst((previous) => ({ ...previous, rating: 0 }));
    }, 1100);

    return () => window.clearTimeout(timeoutId);
  }, [feedbackBurst]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  const playFeedbackTone = (rating) => {
    if (typeof window === "undefined") return;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }

      const audioContext = audioContextRef.current;
      if (audioContext.state === "suspended") {
        audioContext.resume();
      }

      const masterGain = audioContext.createGain();
      masterGain.gain.value = 0.12;
      masterGain.connect(audioContext.destination);

      const startAt = audioContext.currentTime + 0.01;

      if (rating <= 2) {
        scheduleTone(audioContext, masterGain, "triangle", rating === 1 ? 196 : 220, startAt, 0.16, 0.52);
        scheduleTone(audioContext, masterGain, "sine", rating === 1 ? 164 : 185, startAt + 0.08, 0.22, 0.3);
        return;
      }

      const melodicSets = {
        3: [262, 330],
        4: [330, 392, 494],
        5: [392, 494, 587, 784],
      };

      melodicSets[rating].forEach((frequency, index) => {
        scheduleTone(audioContext, masterGain, rating >= 5 ? "sine" : "triangle", frequency, startAt + (index * 0.06), 0.2, 0.42);
      });
    } catch (error) {
      // Ignore audio issues and preserve the UI interaction.
    }
  };

  const triggerFeedbackBurst = (rating) => {
    setFeedbackBurst({ key: Date.now(), rating });
    playFeedbackTone(rating);
  };

  const handleFeedbackSubmit = async (event) => {
    event.preventDefault();
    if (!feedbackRating || !feedbackMessage.trim()) return;

    const reporterEmail = isAuthenticated ? feedbackEmail : `anonymous-guest-${Date.now()}@learnda.local`;

    setFeedbackLoading(true);
    setFeedbackStatus("");
    try {
      await api.support.submitReport({
        name: reporterName,
        email: reporterEmail,
        subject: `${isAuthenticated ? "Footer feedback" : "Anonymous guest feedback"} (${feedbackRating}/${MAX_FEEDBACK_RATING})`,
        category: getFeedbackCategory(feedbackRating),
        message: `Rating: ${feedbackRating}/${MAX_FEEDBACK_RATING}\nAnonymous: ${isAuthenticated ? "No" : "Yes"}\n\nReason: ${feedbackMessage.trim()}`,
      });
      setFeedbackStatus(
        isAuthenticated
          ? "Thanks. Your feedback has been sent and will help us improve the experience."
          : "Thanks. Your feedback has been sent and will help us improve the experience."
      );
      setFeedbackRating(0);
      setFeedbackHover(0);
      setFeedbackMessage("");
    } catch (error) {
      setFeedbackStatus(error.message || "Could not send feedback. Please try again.");
    } finally {
      setFeedbackLoading(false);
    }
  };

  return (
    <>
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-section">
            <Link to="/" className="footer-logo">
              <div className="logo-icon">
                <img src={LOGO_SRC} alt="Learnda logo" className="logo-light" />
                <img src={LOGO_DARK_SRC} alt="Learnda logo" className="logo-dark" />
              </div>
              <div className="footer-brand">
                <h4>Learnda</h4>
                <span className="footer-tagline">Learn Like Never Before</span>
              </div>
            </Link>

            <div className="footer-newsletter is-feedback">
              <div className="newsletter-label feedback-heading">
                <FiEdit3 size={16} />
                <span>Rate and tell us what you think.</span>
              </div>
              <form onSubmit={handleFeedbackSubmit} className="newsletter-form feedback-form">
                  <div className="feedback-rating-shell">
                    <div className="feedback-stars" role="radiogroup" aria-label="Rate Learnda">
                      {Array.from({ length: MAX_FEEDBACK_RATING }, (_, index) => {
                        const ratingValue = index + 1;
                        const isActive = ratingValue <= (feedbackHover || feedbackRating);
                        return (
                          <button
                            key={ratingValue}
                            type="button"
                            className={`feedback-star ${isActive ? "is-active" : ""}`}
                            onClick={() => {
                              setFeedbackRating(ratingValue);
                              setFeedbackStatus("");
                              triggerFeedbackBurst(ratingValue);
                            }}
                            onMouseEnter={() => setFeedbackHover(ratingValue)}
                            onMouseLeave={() => setFeedbackHover(0)}
                            aria-label={`${ratingValue} star${ratingValue > 1 ? "s" : ""}`}
                            aria-checked={feedbackRating === ratingValue}
                            role="radio"
                          >
                            ★
                          </button>
                        );
                      })}
                    </div>
                    {feedbackBurst.rating ? (
                      <div className="feedback-burst" key={feedbackBurst.key} aria-hidden="true">
                        {(FEEDBACK_BURSTS[feedbackBurst.rating] || []).map((particle, index) => (
                          <span
                            key={`${feedbackBurst.key}-${index}`}
                            className={`feedback-particle is-${particle.type} rating-${feedbackBurst.rating}`}
                            style={{
                              left: `${particle.x}%`,
                              top: `${particle.y}%`,
                              animationDelay: `${particle.delay}ms`,
                              "--feedback-drift-x": `${particle.driftX}px`,
                              "--feedback-drift-y": `${particle.driftY}px`,
                              "--feedback-scale": particle.scale,
                            }}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className={`feedback-reason ${feedbackRating ? "is-open" : ""}`}>
                    <div className="feedback-compose">
                      <input
                        type="text"
                        className="newsletter-input feedback-textarea"
                        placeholder={FEEDBACK_PLACEHOLDERS[feedbackRating] || "Tell us more"}
                        required={Boolean(feedbackRating)}
                        value={feedbackMessage}
                        onChange={(event) => setFeedbackMessage(event.target.value)}
                      />
                      <div className="feedback-action-row">
                        <button
                          type="submit"
                          className="feedback-send"
                          disabled={feedbackLoading || !feedbackRating || !feedbackMessage.trim()}
                          aria-label="Send feedback"
                        >
                          <FiSend size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
                {feedbackStatus && (
                  <p className="newsletter-status" role="status" aria-live="polite">
                    {feedbackStatus}
                  </p>
                )}
              </div>
          </div>

          <div className="footer-links">
            <div className="link-group">
              <h5>Platform</h5>
              <ul>
                <li><Link to="/about"><FiInfo aria-hidden /> About Learnda</Link></li>
                <li><Link to="/team"><FiUsers aria-hidden /> Meet the Team</Link></li>
                <li><Link to="/features"><FiGrid aria-hidden /> Contribution Plans</Link></li>
                <li><Link to="/blog"><FiActivity aria-hidden /> Updates Blog</Link></li>
                <li><Link to="/roadmap"><FiCompass aria-hidden /> Platform Roadmap</Link></li>
              </ul>
            </div>

            <div className="link-group">
              <h5>Community</h5>
              <ul>
                {FEATURE_FLAGS.community ? (
                  <li><CommunityForumPicker variant="footer-link" /></li>
                ) : (
                  <ComingSoonItem icon={FiMessageCircle} label="Community Forum" onSelect={setComingSoonFeature} />
                )}
                <li><Link to="/events"><FiStar aria-hidden /> Ambassadors</Link></li>
                <li><Link to="/create"><FiEdit aria-hidden /> Create Content</Link></li>
                <li><Link to="/success-stories"><FiHeart aria-hidden /> Success Stories</Link></li>
              </ul>
            </div>

            <div className="link-group">
              <h5>Development</h5>
              <ul>
                <li><Link to="/report"><FiAlertCircle aria-hidden /> Report Bugs</Link></li>
                <li><Link to="/feature-requests"><FiGift aria-hidden /> Make a Wish</Link></li>
                <li><Link to="/investments"><FiTrendingUp aria-hidden /> Investments</Link></li>
                <li><Link to="/partnerships"><FiGlobe aria-hidden /> Partnerships</Link></li>
                <li><Link to="/join"><FiZap aria-hidden /> Join the Revolution</Link></li>
              </ul>
            </div>

            <div className="link-group">
              <h5>Support</h5>
              <ul>
                <li><Link to="/contribute"><FiDollarSign aria-hidden /> Contribute funds</Link></li>
                <li><Link to="/contact"><FiMail aria-hidden /> Contact Us</Link></li>
                <li><Link to="/our-socials"><FiShare2 aria-hidden /> Our Socials</Link></li>
                <li><Link to="/policies"><FiShield aria-hidden /> Our Policies</Link></li>
                <li><Link to="/terms"><FiFileText aria-hidden /> Terms of Service</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="copyright">
            <p>
              &copy; {new Date().getFullYear()}, Learnda Learning Platform. &nbsp; All rights reserved.
            </p>
          </div>

          <div className="social-links">
            <span className="social-label">Follow us:</span>
            <div className="social-icons">
              <a
                href="https://www.facebook.com/learnda"
                className="social-icon"
                aria-label="Facebook"
                target="_blank"
                rel="noopener noreferrer"
              >
                <FaFacebookF />
              </a>
              <a
                href="https://t.me/learnda"
                className="social-icon"
                aria-label="Telegram"
                target="_blank"
                rel="noopener noreferrer"
              >
                <FaTelegram />
              </a>
              <a
                href="https://www.youtube.com/@learnda"
                className="social-icon"
                aria-label="YouTube"
                target="_blank"
                rel="noopener noreferrer"
              >
                <FaYoutube />
              </a>
              <a
                href="https://tiktok.com/@learnda"
                className="social-icon"
                aria-label="TikTok"
                target="_blank"
                rel="noopener noreferrer"
              >
                <FaTiktok />
              </a>
              <a
                href="https://x.com/learnda"
                className="social-icon"
                aria-label="X"
                target="_blank"
                rel="noopener noreferrer"
              >
                <FaXTwitter />
              </a>
              <a
                href="https://instagram.com/learnda"
                className="social-icon"
                aria-label="Instagram"
                target="_blank"
                rel="noopener noreferrer"
              >
                <FaInstagram />
              </a>
            </div>
          </div>
        </div>
      </footer>

      <button
        className={`back-to-top ${showBackToTop ? "visible" : ""}`}
        onClick={scrollToTop}
        aria-label="Back to top"
        type="button"
      >
        <FiArrowUp size={20} color="white" />
      </button>

      {comingSoonFeature && (
        <ComingSoonPopup feature={comingSoonFeature} onClose={() => setComingSoonFeature(null)} />
      )}
    </>
  );
}
