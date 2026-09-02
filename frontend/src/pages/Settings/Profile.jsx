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
import CoursePickerModal from './CoursePickerModal';
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
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [customEnrolledIds, setCustomEnrolledIds] = useState(new Set());
  const [excludedIds, setExcludedIds] = useState(new Set());
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(null); // { course, isProgramme }
  const [removing, setRemoving] = useState(false);

  const [academicForm, setAcademicForm] = useState({ level: '', semester: '' });
  const [academicLoading, setAcademicLoading] = useState(false);
  const [academicSuccess, setAcademicSuccess] = useState('');
  const [academicErrors, setAcademicErrors] = useState({});
  const [showAcademicConfirm, setShowAcademicConfirm] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileForm({ full_name: user.full_name || '' });
      setAcademicForm({
        level: user.level || '',
        semester: user.semester || '',
      });
    }
  }, [user]);

  const loadCourses = useCallback(async (academicOverride = null) => {
    setCoursesLoading(true);
    try {
      const currentFilters = {
        ...(academicOverride?.level || user?.level || user?.academic_level
          ? { level: academicOverride?.level || user?.level || user?.academic_level }
          : {}),
        ...(academicOverride?.semester || user?.semester || user?.current_semester
          ? { semester: academicOverride?.semester || user?.semester || user?.current_semester }
          : {}),
      };
      const [currentRes, enrolledRes, excludedRes] = await Promise.allSettled([
        api.courses.getCurrent(currentFilters),
        api.courses.getEnrolled(),
        api.courses.getExcluded(),
      ]);
      const current = currentRes.status === 'fulfilled' ? (currentRes.value?.data?.courses || []) : [];
      const enrolled = enrolledRes.status === 'fulfilled' ? (enrolledRes.value?.data?.courses || []) : [];
      const excluded = new Set(
        excludedRes.status === 'fulfilled'
          ? (excludedRes.value?.data?.excluded_course_ids || [])
          : []
      );
      const customIds = new Set(enrolled.map((c) => c.id));
      const seen = new Set(current.map((c) => c.id));
      const merged = [...current];
      enrolled.forEach((c) => { if (!seen.has(c.id)) merged.push(c); });
      setCustomEnrolledIds(customIds);
      setExcludedIds(excluded);
      setEnrolledCourses(merged);
    } finally {
      setCoursesLoading(false);
    }
  }, [user?.academic_level, user?.current_semester, user?.level, user?.semester]);

  useEffect(() => { loadCourses(); }, [loadCourses]);

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

  const handleAcademicSubmit = async () => {
    setShowAcademicConfirm(false);
    setAcademicLoading(true);
    setAcademicErrors({});
    setAcademicSuccess('');
    try {
      const result = await api.me.updateAcademic({
        level: academicForm.level,
        semester: academicForm.semester,
      });
      if (result.success) {
        const academic = {
          level: result.level || academicForm.level,
          semester: result.semester || academicForm.semester,
        };
        setAcademicSuccess('Academic standing updated. Your PLS courses will reflect this change.');
        emitStateChanged([APP_STATE_SCOPES.ACADEMIC, APP_STATE_SCOPES.PROFILE, APP_STATE_SCOPES.SETTINGS], {
          source: 'settings.academic.save',
          academic,
        });
        await Promise.all([
          checkAuth(true),
          loadCourses(academic),
        ]);
      } else {
        setAcademicErrors({ submit: result.error || 'Failed to update.' });
      }
    } catch (error) {
      setAcademicErrors({ submit: error.message || 'An unexpected error occurred.' });
    } finally {
      setAcademicLoading(false);
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

  const handleAddCourse = useCallback(async (courseId) => {
    // If this was a previously excluded programme course, restore it
    if (excludedIds.has(courseId)) {
      await api.courses.removeExcluded(courseId);
      setExcludedIds((prev) => { const next = new Set(prev); next.delete(courseId); return next; });
    } else {
      await api.courses.addEnrolled(courseId);
      setCustomEnrolledIds((prev) => new Set([...prev, courseId]));
    }
    await loadCourses();
    emitStateChanged([APP_STATE_SCOPES.PROFILE], { source: 'settings.courses.add' });
  }, [excludedIds, loadCourses]);

  const handleRemoveCourse = useCallback(async (courseId) => {
    setRemoving(true);
    try {
      if (customEnrolledIds.has(courseId)) {
        await api.courses.removeEnrolled(courseId);
        setCustomEnrolledIds((prev) => { const next = new Set(prev); next.delete(courseId); return next; });
      } else {
        await api.courses.addExcluded(courseId);
        setExcludedIds((prev) => new Set([...prev, courseId]));
      }
      setEnrolledCourses((prev) => prev.filter((c) => c.id !== courseId));
      emitStateChanged([APP_STATE_SCOPES.PROFILE], { source: 'settings.courses.remove' });
    } finally {
      setRemoving(false);
      setRemoveConfirm(null);
    }
  }, [customEnrolledIds]);

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
    {showPicker && (
      <CoursePickerModal
        enrolledIds={[...enrolledCourses.map((c) => c.id)]}
        excludedIds={Array.from(excludedIds)}
        onAdd={handleAddCourse}
        onRemove={(courseId) => {
          const course = enrolledCourses.find((c) => c.id === courseId);
          if (course) setRemoveConfirm({ course, isProgramme: !customEnrolledIds.has(courseId) });
        }}
        onClose={() => setShowPicker(false)}
      />
    )}
    <ConfirmModal
      isOpen={Boolean(removeConfirm)}
      title={`Remove "${removeConfirm?.course?.title}"?`}
      message={
        removeConfirm?.isProgramme
          ? `This course is part of your programme and loads automatically. Removing it will hide it from your PLS and learning dashboard. You can restore it anytime from the course picker.`
          : `This will remove "${removeConfirm?.course?.title}" from your added courses. It will no longer appear in your PLS. You can add it back anytime.`
      }
      confirmLabel={removing ? 'Removing…' : 'Yes, Remove'}
      cancelLabel="Keep It"
      isProcessing={removing}
      onConfirm={() => removeConfirm && handleRemoveCourse(removeConfirm.course.id)}
      onCancel={() => setRemoveConfirm(null)}
    />
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

        <div className="settings-form-section">
          <h3 className="settings-section-title">Academic</h3>

          <div className="settings-form-row">
            <div className="settings-form-group">
              <label className="settings-label">Institution</label>
              <input type="text" value={user?.institution || ''} disabled />
            </div>

            <div className="settings-form-group">
              <label className="settings-label">Programme Category</label>
              <input type="text" value={user?.programme_category || ''} disabled />
            </div>
          </div>

          <div className="settings-form-row">
            <div className="settings-form-group">
              <label className="settings-label">Program</label>
              <input type="text" value={user?.program || user?.academic_program || ''} disabled />
            </div>

            <div className="settings-form-group">
              <label className="settings-label">Index / Application No.</label>
              <input type="text" value={user?.index_number || ''} disabled style={{ textTransform: 'uppercase' }} />
            </div>
          </div>

          <p className="settings-note settings-note--info" style={{ marginBottom: '1.5rem' }}>
            Institution, programme, program, and index number are set during onboarding and cannot be changed here.
          </p>

          <h4 className="settings-section-subtitle">Academic Standing</h4>

          <div className="settings-form-row">
            <div className="settings-form-group">
              <label className="settings-label">Level</label>
              <select
                value={academicForm.level}
                onChange={(e) => setAcademicForm((f) => ({ ...f, level: e.target.value }))}
                disabled={academicLoading}
              >
                <option value="">Select level</option>
                <option value="100">Level 100</option>
                <option value="200">Level 200</option>
                <option value="300">Level 300</option>
                <option value="400">Level 400</option>
                <option value="graduate">Graduate</option>
              </select>
            </div>

            <div className="settings-form-group">
              <label className="settings-label">Semester</label>
              <select
                value={academicForm.semester}
                onChange={(e) => setAcademicForm((f) => ({ ...f, semester: e.target.value }))}
                disabled={academicLoading}
              >
                <option value="">Select semester</option>
                <option value="1">Semester 1</option>
                <option value="2">Semester 2</option>
              </select>
            </div>
          </div>

          {(academicForm.level !== (user?.level || '') || academicForm.semester !== (user?.semester || '')) && (
            <p className="settings-note settings-note--warning">
              <FiAlertCircle style={{ flexShrink: 0, marginTop: 1 }} />
              Changing your level or semester will update the courses shown in your PLS. Your progress and history will remain intact.
            </p>
          )}

          {academicSuccess && (
            <div className="settings-success-message">
              <span className="success-icon"><FiCheckCircle /></span> {academicSuccess}
            </div>
          )}

          {academicErrors.submit && (
            <div className="settings-error-message">
              <span className="error-icon"><FiAlertCircle /></span> {academicErrors.submit}
            </div>
          )}

          <div className="form-actions" style={{ marginTop: '0.75rem' }}>
            <button
              type="button"
              className="settings-save-btn"
              disabled={academicLoading || (!academicForm.level && !academicForm.semester) || (academicForm.level === (user?.level || '') && academicForm.semester === (user?.semester || ''))}
              onClick={() => setShowAcademicConfirm(true)}
            >
              <FiSave />
              <span>{academicLoading ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </div>

        <div className="settings-form-section">
          <div className="settings-courses-head">
            <h3 className="settings-section-title">Your Courses</h3>
            <button
              type="button"
              className="settings-inline-btn primary"
              onClick={() => setShowPicker(true)}
            >
              <FiPlus /> Add Course
            </button>
          </div>

          {coursesLoading ? (
            <p className="settings-note">Loading courses...</p>
          ) : enrolledCourses.length === 0 ? (
            <p className="settings-note settings-note--info">
              No courses yet. Your programme courses load automatically — use the picker to add more or restore removed ones.
            </p>
          ) : (
            <div className="settings-courses-grid">
              {enrolledCourses.map((course) => (
                <div key={course.id} className="settings-course-card">
                  <div className="settings-course-card-img">
                    {course.image_url ? (
                      <img src={course.image_url} alt={course.title} loading="lazy" />
                    ) : (
                      <div className="settings-course-card-placeholder">
                        <FiBookOpen />
                      </div>
                    )}
                  </div>
                  <div className="settings-course-card-body">
                    <p className="settings-course-card-title">{course.title}</p>
                    {course.code ? <span className="settings-course-card-code">{course.code}</span> : null}
                  </div>
                  <button
                    type="button"
                    className="settings-course-card-remove"
                    onClick={() => setRemoveConfirm({
                      course,
                      isProgramme: !customEnrolledIds.has(course.id),
                    })}
                    aria-label={`Remove ${course.title}`}
                    title="Remove course"
                  >
                    <FiX />
                  </button>
                </div>
              ))}
            </div>
          )}
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
      message="Changing your level or semester will update the courses shown in your PLS. Your progress, downloads, and history will remain intact. Continue?"
      confirmLabel="Yes, Update"
      cancelLabel="Cancel"
      onConfirm={handleAcademicSubmit}
      onCancel={() => setShowAcademicConfirm(false)}
    />
    </>
  );
}
