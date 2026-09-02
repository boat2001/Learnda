import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import api from "../../services/api";
import "./Rewards.css";

export default function ContributeEarn() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!isAuthenticated) return;
    const loadSummary = async () => {
      try {
        const response = await api.rewards.getSummary();
        setSummary(response?.summary || null);
      } catch (error) {
        setStatus(error.message || "Unable to load contribution rewards.");
      }
    };
    loadSummary();
  }, [isAuthenticated]);

  const contributeStage = summary?.stages?.contribute || {};

  const claimContribution = async () => {
    try {
      const response = await api.rewards.claim({ type: "contribute_bonus" });
      if (response?.success) {
        setStatus("Contribution reward claimed!");
        const refreshed = await api.rewards.getSummary();
        setSummary(refreshed?.summary || null);
      } else {
        setStatus(response?.error || "Unable to claim contribution reward.");
      }
    } catch (error) {
      setStatus(error.message || "Unable to claim contribution reward.");
    }
  };

  return (
    <div className="rewards-page">
      <section className="rewards-hero">
        <div className="hero-text">
          <span className="hero-tag">Rewards & Contributions</span>
          <h1>Contribute to earn XP on Learnda</h1>
          <p>
            Upload study resources, create lessons, and help other learners. Every approved
            contribution earns you XP based on how students engage with it.
          </p>
        </div>
        <div className="hero-card">
          <p className="hero-card-label">Eligible contributions</p>
          <p className="hero-card-value">Files, edutainment, text lessons, videos</p>
          <p className="hero-card-note">XP is awarded based on views, downloads, and completion.</p>
        </div>
      </section>

      <section className="reward-breakdown">
        <h2>Contribution XP milestone</h2>
        <div className="stage-grid">
          <div className="stage-card">
            <span className={`stage-status ${contributeStage.status || "locked"}`}>
              {contributeStage.status || "locked"}
            </span>
            <h3>First approved contribution</h3>
            <p>Reward: +50 XP</p>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={claimContribution}
              disabled={contributeStage.status !== "ready"}
            >
              Claim reward
            </button>
          </div>
        </div>
      </section>

      <section className="reward-breakdown">
        <h2>How XP is calculated</h2>
        <ul>
          <li>
            <strong>Engagement-based</strong> - XP scales with real student activity on your content.
          </li>
          <li>
            <strong>Audience growth</strong> - repeat viewers and downloads increase your XP gains.
          </li>
          <li>
            <strong>Contribution level</strong> - Helper and Hero contributors earn bonus XP for every piece of content approved.
          </li>
          <li>
            <strong>Quality matters</strong> - approved content with strong feedback gets featured and earns more XP.
          </li>
        </ul>
      </section>

      <section className="rewards-actions">
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => navigate("/contribute")}
        >
          Start contributing
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => navigate("/contribute")}
        >
          Create content
        </button>
      </section>
      {status && <p className="status-message">{status}</p>}
    </div>
  );
}
