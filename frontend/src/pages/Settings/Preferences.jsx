import { useState, useEffect } from 'react';
import {
  FiSliders,
  FiMonitor,
  FiSun,
  FiMoon,
  FiMonitor as FiAutoTheme,
  FiRotateCcw,
  FiSave,
  FiCheckCircle,
  FiVolume2,
} from 'react-icons/fi';
import { useAnalytics } from '../../hooks/useAnalytics';
import api from '../../services/api';
import { APP_STATE_SCOPES, emitStateChanged, emitThemeChanged } from '../../utils/appEvents';
import { normalizeThemePreference, saveThemePreference, getStoredThemePreference } from '../../utils/theme';
import { syncUiSoundsFromPreference } from '../../utils/uiSounds';
import './Settings.css';

const DEFAULT_PREFERENCES = {
  difficulty_level: 'intermediate',
  learning_style: 'visual',
  daily_goal_minutes: 60,
  text_size: 'medium',
  theme: 'auto',
  reduced_motion: false,
  ui_sounds: true,
  show_profile: true,
  show_progress: true,
  email_notifications: true,
  push_notifications: true,
  auto_update_academic_state: true,
};

const themes = [
  { value: 'light', label: 'Light', icon: <FiSun /> },
  { value: 'dark', label: 'Dark', icon: <FiMoon /> },
  { value: 'auto', label: 'Auto', icon: <FiAutoTheme /> },
];

export default function Preferences() {
  const { trackEvent } = useAnalytics();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    setLoading(true);
    try {
      const data = await api.user.getPreferences();
      if (data?.success) {
        const savedPreferences = {
          ...DEFAULT_PREFERENCES,
          ...(data.preferences || {}),
        };
        // Show the currently active theme (from localStorage), not the server-saved value.
        // Calling saveThemePreference/emitThemeChanged here would override whatever the
        // user set via the header toggle, switching the page theme unexpectedly.
        savedPreferences.theme = getStoredThemePreference();
        setPreferences(savedPreferences);
        syncUiSoundsFromPreference(savedPreferences.ui_sounds !== false);
        trackEvent('preferences_loaded');
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      setError(error.message || 'Unable to load preferences.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key, value) => {
    const nextValue = key === 'theme' ? normalizeThemePreference(value) : value;

    setPreferences((prev) => ({
      ...prev,
      [key]: nextValue,
    }));

    if (key === 'theme') {
      const { preference, resolved } = saveThemePreference(nextValue);
      emitThemeChanged(preference);
      emitStateChanged([APP_STATE_SCOPES.PREFERENCES], {
        source: 'settings.preferences.theme',
      });
      trackEvent('preference_changed', { key, value: preference, applied_theme: resolved });
      return;
    }

    if (key === 'ui_sounds') {
      syncUiSoundsFromPreference(Boolean(nextValue));
    }

    trackEvent('preference_changed', { key, value: nextValue });
  };

  const savePreferences = async () => {
    setSaving(true);
    setSuccess('');
    setError('');

    try {
      const data = await api.user.updatePreferences(preferences);
      if (data?.success) {
        const savedPreferences = {
          ...DEFAULT_PREFERENCES,
          ...(data.preferences || preferences),
        };
        setPreferences(savedPreferences);
        saveThemePreference(savedPreferences.theme);
        emitThemeChanged(savedPreferences.theme);
        syncUiSoundsFromPreference(savedPreferences.ui_sounds !== false);
        emitStateChanged([APP_STATE_SCOPES.PREFERENCES], {
          source: 'settings.preferences.save',
        });
        setSuccess('Preferences saved.');
        trackEvent('preferences_saved', { preferences: savedPreferences });
      } else {
        throw new Error(data?.error || 'Unable to save preferences.');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      setError(error.message || 'Unable to save preferences.');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    setPreferences(DEFAULT_PREFERENCES);
    saveThemePreference(DEFAULT_PREFERENCES.theme);
    emitThemeChanged(DEFAULT_PREFERENCES.theme);
    syncUiSoundsFromPreference(DEFAULT_PREFERENCES.ui_sounds !== false);
    emitStateChanged([APP_STATE_SCOPES.PREFERENCES], {
      source: 'settings.preferences.reset',
    });
    setSuccess('');
    setError('');
    trackEvent('preferences_reset');
  };

  if (loading) {
    return (
      <div className="preferences-loading">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="preferences-settings">
      <div className="settings-title-row">
        <span className="settings-title-icon"><FiSliders /></span>
        <h2>Preferences</h2>
      </div>

      <div className="preferences-sections">
        <div className="preferences-section">
          <h3 className="settings-section-title">
            <FiMonitor />
            <span>Display</span>
          </h3>

          <div className="preference-row">
            <div className="preference-label">Theme</div>
            <div className="theme-selector">
              {themes.map((theme) => (
                <button
                  key={theme.value}
                  className={`theme-btn ${preferences.theme === theme.value ? 'active' : ''}`}
                  onClick={() => handleChange('theme', theme.value)}
                  type="button"
                  title={theme.label}
                >
                  <span className="theme-icon">{theme.icon}</span>
                  <span className="theme-label">{theme.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="preference-row preference-row--sounds">
            <div className="sounds-row-content">
              <span className="sounds-icon" aria-hidden><FiVolume2 /></span>
              <div className="sounds-details">
                <div className="preference-label">Interface sounds</div>
                <div className="preference-toggle-hint">
                  Short tones for lessons, downloads, chat, and dialogs
                </div>
              </div>
            </div>
            <label className="toggle-switch" title={preferences.ui_sounds ? 'Turn off sounds' : 'Turn on sounds'}>
              <input
                type="checkbox"
                checked={Boolean(preferences.ui_sounds)}
                onChange={(e) => handleChange('ui_sounds', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>

        <div className="preferences-section">
          <h3 className="settings-section-title">
            <FiSliders />
            <span>Academic</span>
          </h3>

          <div className="preference-row preference-row--sounds">
            <div className="sounds-row-content">
              <span className="sounds-icon" aria-hidden><FiRotateCcw /></span>
              <div className="sounds-details">
                <div className="preference-label">Auto update level and semester</div>
                <div className="preference-toggle-hint">
                  Let Learnda move your courses when your college switches semester or level
                </div>
              </div>
            </div>
            <label
              className="toggle-switch"
              title={preferences.auto_update_academic_state ? 'Turn off academic auto updates' : 'Turn on academic auto updates'}
            >
              <input
                type="checkbox"
                checked={preferences.auto_update_academic_state !== false}
                onChange={(e) => handleChange('auto_update_academic_state', e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
      </div>

      {success && (
        <div className="settings-success-message">
          <span className="success-icon"><FiCheckCircle /></span>
          {success}
        </div>
      )}

      {error && (
        <div className="settings-error-message">
          {error}
        </div>
      )}

      <div className="preferences-actions">
        <button
          className="settings-reset-btn"
          onClick={resetToDefaults}
          disabled={saving}
          type="button"
        >
          <FiRotateCcw />
          <span>Reset</span>
        </button>
        <button
          className="settings-save-btn"
          onClick={savePreferences}
          disabled={saving}
          type="button"
        >
          <FiSave />
          <span>{saving ? 'Saving...' : 'Save'}</span>
        </button>
      </div>
    </div>
  );
}
