import { useRef, useState, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  FiUser,
  FiCheckCircle,
  FiAlertCircle,
  FiCamera,
  FiSave,
  FiPlus,
  FiX,
  FiBookOpen
} from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import { useAnalytics } from '../../hooks/useAnalytics';
import api, { resolveUploadUrl } from '../../services/api';
import { APP_STATE_SCOPES, emitStateChanged } from '../../utils/appEvents';
import { getUserDisplayContact, isPhonePlaceholderEmail } from '../../utils/displayContact';
const AvatarCropModal = lazy(() => import('../../components/AvatarCropModal'));
import ConfirmModal from '../../components/common/ConfirmModal';
import './Settings.css';

export default function Profile() {
  const { user, updateUser, checkAuth } = useAuth();
  const { trackEvent } = useAnalytics();
  const avatarInputRef = useRef(null);

  const [profileForm, setProfileForm] = useState({ full_name: '' });
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [errors, setErrors] = useState({});
  const [cropSrc, setCropSrc] = useState(null);


  useEffect(() => {
    if (user) {
      setProfileForm({ full_name: user.full_name || '' });
      setAcademicForm({
        level: user.level || '',
      });
    }
  }, [user]);


  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
    if (success) setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!profileForm.full_name.trim()) {
      setErrors({ full_name: 'Full name is required' });
      return;
    }

    setLoading(true);
    setErrors({});
    setSuccess('');

    try {
      const result = await updateUser({
        full_name: profileForm.full_name.trim(),
      });

      if (result.success) {
        setSuccess('Profile updated.');
        emitStateChanged([APP_STATE_SCOPES.PROFILE, APP_STATE_SCOPES.SETTINGS], {
          source: 'settings.profile.save',
        });
        trackEvent('profile_updated');
      } else {
        setErrors({ submit: result.error || 'Failed to update profile' });
      }
    } catch (error) {
      setErrors({ submit: error.message || 'An unexpected error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setAvatarError('Upload a JPG, PNG, GIF, or WEBP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Avatar must be 5MB or smaller.');
      return;
    }

    setAvatarError('');
    const objectUrl = URL.createObjectURL(file);
    setCropSrc(objectUrl);
  };

  const handleCropConfirm = useCallback(async (blob) => {
    const objectUrl = cropSrc;
    setCropSrc(null);

    const formData = new FormData();
    formData.append('avatar', blob, 'avatar.jpg');

    setAvatarLoading(true);
    setAvatarError('');
    try {
      const data = await api.user.updateAvatar(formData);
      if (data?.success) {
        trackEvent('avatar_updated', { file_type: 'image/jpeg' });
        await checkAuth(true);
        emitStateChanged([APP_STATE_SCOPES.PROFILE], { source: 'settings.profile.avatar' });
        setSuccess('Photo updated.');
      } else {
        setAvatarError(data?.error || 'Failed to upload photo.');
      }
    } catch (error) {
      setAvatarError(error.message || 'Failed to upload photo.');
    } finally {
      setAvatarLoading(false);
      URL.revokeObjectURL(objectUrl);
    }
  }, [cropSrc, trackEvent, checkAuth]);

  const handleCropCancel = useCallback(() => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }, [cropSrc]);

  const displayContact = getUserDisplayContact(user);
  const contactLabel = isPhonePlaceholderEmail(user?.email) ? 'Phone' : 'Email';

  return (
    <>
    {cropSrc && (
      <Suspense fallback={null}>
        <AvatarCropModal
          src={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      </Suspense>
    )}
    <div className="profile-settings">
      <div className="settings-title-row">
        <span className="settings-title-icon"><FiUser /></span>
        <h2>Profile</h2>
      </div>

      <div className="profile-header">
        <div className="avatar-section">
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            style={{ display: 'none' }}
            disabled={avatarLoading}
          />
          <button
            type="button"
            className="avatar-container avatar-container--clickable"
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarLoading}
            title="Change profile photo"
          >
            {user?.avatar_url ? (
              <img src={resolveUploadUrl(user.avatar_url)} alt={user.full_name} className="avatar-image" />
            ) : (
              <div className="avatar-placeholder">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
            )}
            <span className="avatar-edit-overlay" aria-hidden>
              <FiCamera />
            </span>
          </button>
          <div className="avatar-actions">
            <p className="avatar-hint">
              {avatarLoading ? 'Uploading...' : 'Click photo to change · JPG/PNG, 5MB max'}
            </p>
            {avatarError ? <span className="settings-field-error">{avatarError}</span> : null}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="profile-form">
        <div className="settings-form-section">
          <h3 className="settings-section-title">Personal</h3>

          <div className="settings-form-row">
            <div className="settings-form-group">
              <label htmlFor="full_name" className="settings-label">Full Name *</label>
              <input
                type="text"
                id="full_name"
                name="full_name"
                value={profileForm.full_name}
                onChange={handleChange}
                disabled={loading}
                className={errors.full_name ? 'error' : ''}
              />
              {errors.full_name && <span className="settings-field-error">{errors.full_name}</span>}
            </div>

            <div className="settings-form-group">
              <label className="settings-label">{contactLabel}</label>
              <input type="text" value={displayContact || ''} disabled />
            </div>
          </div>
        </div>

        {/* Class placement is read-only (§1.4, §6.4): a learner cannot change
            their own class, and their subjects follow from it (§5). An editable
            "Academic Standing" and a "Your Courses" picker used to live here. */}
        <div className="settings-form-section">
          <h3 className="settings-section-title">Your class</h3>
          <div className="settings-class-card">
            <div className="settings-class-card__row">
              <span className="settings-class-card__label">Current class</span>
              <strong className="settings-class-card__value">
                {user?.class_level ? getClassLabel(user.class_level) : 'Not set yet'}
              </strong>
            </div>
            {user?.academic_year && (
              <div className="settings-class-card__row">
                <span className="settings-class-card__label">Academic year</span>
                <strong className="settings-class-card__value">{user.academic_year}</strong>
              </div>
            )}
          </div>
          <p className="settings-note settings-note--info">
            You move up a class automatically at the start of each school year.
            If your class is wrong, ask a parent or your school to correct it.
          </p>
        </div>

        {success && (
          <div className="settings-success-message">
            <span className="success-icon"><FiCheckCircle /></span> {success}
          </div>
        )}

        {errors.submit && (
          <div className="settings-error-message">
            <span className="error-icon"><FiAlertCircle /></span> {errors.submit}
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="settings-save-btn" disabled={loading}>
            <FiSave />
            <span>{loading ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </form>
    </div>
    <ConfirmModal
      isOpen={showAcademicConfirm}
      title="Update Academic Standing"
      message="Save these changes to your profile?"
      confirmLabel="Yes, Update"
      cancelLabel="Cancel"
      onConfirm={handleAcademicSubmit}
      onCancel={() => setShowAcademicConfirm(false)}
    />
    </>
  );
}
