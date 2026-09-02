import { Component } from 'react';
import { Link } from 'react-router-dom';
import './ErrorBoundary.css';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false };
  }

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error, info) {
    console.error('[Sharether] Render error:', error, info?.componentStack);
  }

  reset() {
    this.setState({ crashed: false });
  }

  render() {
    if (!this.state.crashed) return this.props.children;

    return (
      <div className="eb-shell">
        <div className="eb-card">
          <div className="eb-icon" aria-hidden="true">⚠</div>
          <h1 className="eb-title">Something went wrong</h1>
          <p className="eb-body">
            This page ran into an unexpected error. Your account and data are fine — this
            is usually caused by a temporary glitch or a network hiccup.
          </p>
          <div className="eb-actions">
            <button
              className="eb-btn eb-btn--primary"
              type="button"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
            <Link
              className="eb-btn eb-btn--secondary"
              to="/"
            >
              Go to home
            </Link>
          </div>
          <p className="eb-hint">
            If this keeps happening, contact support from the{' '}
            <Link to="/contact" className="eb-link">Contact page</Link>.
          </p>
        </div>
      </div>
    );
  }
}
