import { useEffect, useMemo, useRef, useState } from 'react';
import { FiCheckCircle, FiUploadCloud } from 'react-icons/fi';
import FormContactIdentity from '../common/FormContactIdentity';
import FormModal from '../common/FormModal';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { saveCreatorDraft } from '../../utils/creatorDrafts';
import './CreatorSubmissionModal.css';

const CREATOR_SECTION_MAP = {
  'file': 'study-tools',
  'video': 'study-tools',
  'study-group': 'study-tools',
  'survival-guide': 'deep-dives',
  'article': 'deep-dives',
  'story': 'deep-dives',
  'quote': 'quick-sparks',
  'did-you-know': 'quick-sparks',
  'joke': 'quick-sparks',
};

const READING_MINUTES = [1, 2, 3, 4, 5];
const GROUP_LEVELS = ['100', '200', '300', '400', '500'];
const FILE_TYPES = [
  { value: 'course_notes', label: 'Course notes' },
  { value: 'course_outlines', label: 'Course outlines' },
  { value: 'mid_sem_quiz', label: 'Mid-Sem quiz' },
  { value: 'end_of_sem_exams', label: 'End of Sem Exams' },
  { value: 'other_files', label: 'Other files' },
];
const CREATOR_COURSE_OPTION_LIMIT = 8;

let creatorCourseOptionsPromise;

const loadCreatorCourseOptions = () => {
  if (!creatorCourseOptionsPromise) {
    creatorCourseOptionsPromise = api.subjects.getAll()
      .then((response) => response?.data?.subjects || [])
      .catch((error) => {
        creatorCourseOptionsPromise = null;
        throw error;
      });
  }

  return creatorCourseOptionsPromise;
};

const normalizeCourseOptionText = (value) => String(value || '').trim().toLowerCase();

const filterCourseOptions = (courses, query) => {
  const typed = normalizeCourseOptionText(query);
  if (!typed) return courses.slice(0, CREATOR_COURSE_OPTION_LIMIT);

  return courses
    .filter((option) => (
      [option.title, option.code, option.department]
        .some((value) => normalizeCourseOptionText(value).includes(typed))
    ))
    .sort((left, right) => {
      const leftTitle = normalizeCourseOptionText(left.title);
      const rightTitle = normalizeCourseOptionText(right.title);
      const leftCode = normalizeCourseOptionText(left.code);
      const rightCode = normalizeCourseOptionText(right.code);
      const leftStarts = leftTitle.startsWith(typed) || leftCode.startsWith(typed);
      const rightStarts = rightTitle.startsWith(typed) || rightCode.startsWith(typed);

      if (leftStarts !== rightStarts) return leftStarts ? -1 : 1;
      return leftTitle.localeCompare(rightTitle);
    })
    .slice(0, CREATOR_COURSE_OPTION_LIMIT);
};

const createParagraph = () => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  subheading: '',
  body: '',
  image: null,
});

const getInitialParagraphs = () => [createParagraph()];

const getDraftHeading = (creatorType, form) => {
  const selectors = {
    file: '#creator-file-name',
    video: '#creator-video-title',
    'study-group': '#creator-group-name',
    'survival-guide': '#creator-guide-title',
    article: '#creator-article-title',
    story: '#creator-story-title',
  };
  const fieldValue = form?.querySelector(selectors[creatorType?.id])?.value?.trim();
  return fieldValue || creatorType?.title || 'Untitled draft';
};

const readDraftField = (draft, field) => draft?.fields?.[field] || '';

const readDraftCourse = (draft) => {
  const rawCourse = readDraftField(draft, 'creator-course-course-name-selection');
  if (!rawCourse) return null;

  try {
    return JSON.parse(rawCourse);
  } catch (_error) {
    return null;
  }
};

const getDraftParagraphs = (draft, groupKey) => {
  const paragraphs = draft?.paragraphGroups?.[groupKey];
  if (!Array.isArray(paragraphs) || paragraphs.length === 0) return getInitialParagraphs();

  return paragraphs.map((paragraph) => ({
    id: paragraph.id || createParagraph().id,
    subheading: paragraph.subheading || '',
    body: paragraph.body || '',
    image: null,
  }));
};

const collectDraftFields = (form) => Array.from(form?.elements || []).reduce((fields, element) => {
  if (!element || element.disabled || ['button', 'submit', 'file'].includes(element.type)) return fields;

  if (element.type === 'radio') {
    if (element.checked && element.name) fields[element.name] = element.value;
    return fields;
  }

  const key = element.id || element.name;
  if (!key) return fields;

  fields[key] = element.type === 'checkbox' ? element.checked : element.value;
  return fields;
}, {});

const collectParagraphGroups = (form) => Array.from(
  form?.querySelectorAll('[data-draft-paragraph-group]') || []
).reduce((groups, fieldset) => {
  const groupKey = fieldset.dataset.draftParagraphGroup;
  if (!groupKey) return groups;

  groups[groupKey] = Array.from(fieldset.querySelectorAll('.creator-paragraph')).map((paragraph) => {
    const subheading = paragraph.querySelector('input[id$="-subheading"]');
    const body = paragraph.querySelector('textarea[id$="-body"]');
    const paragraphId = body?.id?.replace(/-body$/, '') || subheading?.id?.replace(/-subheading$/, '');

    return {
      id: paragraphId || createParagraph().id,
      subheading: subheading?.value || '',
      body: body?.value || '',
    };
  });

  return groups;
}, {});

function CreatorTypeBanner({ creatorType }) {
  if (!creatorType) return null;
  const Icon = creatorType.icon;
  const sectionId = CREATOR_SECTION_MAP[creatorType.id] || 'study-tools';
  return (
    <div className={`creator-type-banner creator-type-banner--${sectionId}`}>
      <span className="creator-type-banner-icon" aria-hidden="true">
        <Icon />
      </span>
      <div className="creator-type-banner-text">
        <strong>{creatorType.title}</strong>
        {creatorType.description && <p>{creatorType.description}</p>}
      </div>
    </div>
  );
}

function FileUploadField({ id, label, accept, required, onChange }) {
  const [fileName, setFileName] = useState('');
  const hasFile = Boolean(fileName);

  const handleChange = (e) => {
    const file = e.target.files?.[0] || null;
    setFileName(file?.name || '');
    onChange?.(file);
  };

  return (
    <div className="form-row">
      <label htmlFor={id}>{label}{required ? ' *' : ''}</label>
      <div className={`creator-file-zone${hasFile ? ' creator-file-zone--has-file' : ''}`}>
        <input
          id={id}
          type="file"
          accept={accept}
          required={required}
          className="creator-file-zone-input"
          onChange={handleChange}
        />
        {hasFile ? (
          <>
            <FiCheckCircle className="creator-file-zone-icon" aria-hidden="true" />
            <span className="creator-file-zone-name">{fileName}</span>
            <span className="creator-file-zone-change">Click to change</span>
          </>
        ) : (
          <>
            <FiUploadCloud className="creator-file-zone-icon" aria-hidden="true" />
            <span className="creator-file-zone-label">Click to upload</span>
          </>
        )}
      </div>
    </div>
  );
}

function CourseSelector({ label, course, onSelect, initialQuery = '', required = true }) {
  const inputRef = useRef(null);
  const [query, setQuery] = useState(course?.title || initialQuery || '');
  const [courseOptions, setCourseOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeOptionIndex, setActiveOptionIndex] = useState(-1);
  const listId = `creator-course-${label.replace(/\s+/g, '-').toLowerCase()}-options`;
  const selectionFieldId = `creator-course-${label.replace(/\s+/g, '-').toLowerCase()}-selection`;
  const options = useMemo(
    () => filterCourseOptions(courseOptions, query),
    [courseOptions, query]
  );
  const showOptions = open && !course;

  const selectCourse = (option) => {
    onSelect(option);
    setQuery(option.title || option.code || '');
    setOpen(false);
    setActiveOptionIndex(-1);
  };

  useEffect(() => {
    setQuery(course?.title || initialQuery || '');
  }, [course?.id, course?.title, initialQuery]);

  useEffect(() => {
    inputRef.current?.setCustomValidity(required && !course ? 'Select a course from the matching options.' : '');
  }, [course, required]);

  const ensureCourseOptions = () => {
    if (courseOptions.length > 0 || loading) return;
    let cancelled = false;
    setLoading(true);
    loadCreatorCourseOptions()
      .then((loadedOptions) => {
        if (!cancelled) {
          setCourseOptions(loadedOptions);
          setActiveOptionIndex(-1);
        }
      })
      .catch(() => {
        if (!cancelled) setCourseOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  };

  useEffect(() => ensureCourseOptions(), []);

  return (
    <div className="form-row creator-course-field">
      <label htmlFor={`creator-course-${label.replace(/\s+/g, '-').toLowerCase()}`}>
        {label}{required ? ' *' : ''}
      </label>
      <input
        ref={inputRef}
        id={`creator-course-${label.replace(/\s+/g, '-').toLowerCase()}`}
        type="text"
        value={query}
        required={required}
        placeholder="Type a subject name"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={showOptions}
        aria-activedescendant={activeOptionIndex >= 0 ? `${listId}-${options[activeOptionIndex]?.id}` : undefined}
        onChange={(event) => {
          setQuery(event.target.value);
          onSelect(null);
          setOpen(true);
          ensureCourseOptions();
          event.target.setCustomValidity(required ? 'Select a course from the matching options.' : '');
        }}
        onFocus={() => {
          setOpen(true);
          ensureCourseOptions();
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 90)}
        onKeyDown={(event) => {
          if (!showOptions || options.length === 0) return;

          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveOptionIndex((current) => (current + 1) % options.length);
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveOptionIndex((current) => (
              current <= 0 ? options.length - 1 : current - 1
            ));
          }

          if (event.key === 'Enter' && activeOptionIndex >= 0) {
            event.preventDefault();
            selectCourse(options[activeOptionIndex]);
          }

          if (event.key === 'Escape') {
            setOpen(false);
            setActiveOptionIndex(-1);
          }
        }}
      />
      <input
        id={selectionFieldId}
        type="hidden"
        value={course ? JSON.stringify(course) : ''}
        readOnly
      />
      {course ? (
        <div className="creator-selected-course">
          <span>{course.title}</span>
          {course.code ? <small>{course.code}</small> : null}
        </div>
      ) : null}
      {showOptions ? (
        <div className="creator-course-options" id={listId} role="listbox" aria-live="polite">
          {loading ? <p>Loading course options...</p> : null}
          {!loading && options.length === 0 ? <p>No matching courses yet.</p> : null}
          {options.map((option, index) => (
            <button
              className={index === activeOptionIndex ? 'is-active' : ''}
              key={option.id}
              id={`${listId}-${option.id}`}
              type="button"
              role="option"
              aria-selected={index === activeOptionIndex}
              onMouseEnter={() => setActiveOptionIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectCourse(option)}
            >
              <strong>{option.title}</strong>
              {option.code || option.department ? (
                <span>{[option.code, option.department].filter(Boolean).join(' - ')}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ParagraphFields({ groupKey, paragraphs, onChange, sectionLabel }) {
  const updateParagraph = (id, field, value) => {
    onChange(paragraphs.map((paragraph) => (
      paragraph.id === id ? { ...paragraph, [field]: value } : paragraph
    )));
  };

  return (
    <fieldset className="creator-fieldset" data-draft-paragraph-group={groupKey}>
      <legend>{sectionLabel}</legend>
      {paragraphs.map((paragraph, index) => (
        <div className="creator-paragraph" key={paragraph.id}>
          <div className="creator-paragraph-header">
            <strong>Paragraph {index + 1}</strong>
            {paragraphs.length > 1 ? (
              <button
                type="button"
                onClick={() => onChange(paragraphs.filter((item) => item.id !== paragraph.id))}
              >
                Remove
              </button>
            ) : null}
          </div>
          <div className="form-row">
            <label htmlFor={`${paragraph.id}-subheading`}>Subheading (optional)</label>
            <input
              id={`${paragraph.id}-subheading`}
              type="text"
              value={paragraph.subheading}
              onChange={(event) => updateParagraph(paragraph.id, 'subheading', event.target.value)}
            />
          </div>
          <div className="form-row">
            <label htmlFor={`${paragraph.id}-body`}>Paragraph content *</label>
            <textarea
              id={`${paragraph.id}-body`}
              value={paragraph.body}
              rows={4}
              required
              onChange={(event) => updateParagraph(paragraph.id, 'body', event.target.value)}
            />
          </div>
          <FileUploadField
            id={`${paragraph.id}-image`}
            label="Paragraph image (optional)"
            accept="image/*"
            onChange={(file) => updateParagraph(paragraph.id, 'image', file)}
          />
        </div>
      ))}
      <button
        className="btn btn-secondary creator-add-paragraph"
        type="button"
        onClick={() => onChange([...paragraphs, createParagraph()])}
      >
        Add paragraph
      </button>
    </fieldset>
  );
}

function ReadingMinutesSelect({ value, onChange }) {
  return (
    <div className="form-row">
      <label htmlFor="creator-reading-minutes">Reading time *</label>
      <select
        id="creator-reading-minutes"
        value={value}
        required
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select minutes</option>
        {READING_MINUTES.map((minutes) => (
          <option key={minutes} value={minutes}>
            {minutes} min read
          </option>
        ))}
      </select>
    </div>
  );
}

function FileForm({ draft }) {
  const [course, setCourse] = useState(() => readDraftCourse(draft));

  return (
    <>
      <div className="creator-form-grid">
        <div className="form-row">
          <label htmlFor="creator-file-type">File type *</label>
          <select id="creator-file-type" required defaultValue={readDraftField(draft, 'creator-file-type')}>
            <option value="" disabled>Select file type</option>
            {FILE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label htmlFor="creator-file-name">File name *</label>
          <input id="creator-file-name" type="text" required defaultValue={readDraftField(draft, 'creator-file-name')} />
        </div>
      </div>
      <CourseSelector
        label="Course name"
        course={course}
        initialQuery={readDraftField(draft, 'creator-course-course-name')}
        onSelect={setCourse}
      />
      <FileUploadField id="creator-file-upload" label="Upload file" required />
    </>
  );
}

function VideoForm({ draft }) {
  const [course, setCourse] = useState(() => readDraftCourse(draft));

  return (
    <>
      <div className="creator-form-grid">
        <CourseSelector
          label="Course name"
          course={course}
          initialQuery={readDraftField(draft, 'creator-course-course-name')}
          onSelect={setCourse}
        />
        <div className="form-row">
          <label htmlFor="creator-video-topics">Topics covered *</label>
          <input
            id="creator-video-topics"
            type="text"
            required
            defaultValue={readDraftField(draft, 'creator-video-topics')}
            placeholder="Add topics separated by commas"
          />
        </div>
      </div>
      <div className="form-row">
        <label htmlFor="creator-video-title">Video title *</label>
        <input id="creator-video-title" type="text" required defaultValue={readDraftField(draft, 'creator-video-title')} />
      </div>
      <div className="creator-form-grid">
        <FileUploadField id="creator-video-upload" label="Video" accept="video/*" required />
        <FileUploadField id="creator-video-thumbnail" label="Thumbnail (optional)" accept="image/*" />
      </div>
    </>
  );
}

function StudyGroupForm({ draft }) {
  const [visibility, setVisibility] = useState(() => readDraftField(draft, 'creator-group-visibility') || 'open');
  const [programs, setPrograms] = useState([]);


  return (
    <>
      <div className="creator-form-grid">
        <div className="form-row">
          <label htmlFor="creator-group-name">Group name *</label>
          <input id="creator-group-name" type="text" required defaultValue={readDraftField(draft, 'creator-group-name')} />
        </div>
        <FileUploadField id="creator-group-image" label="Group image" accept="image/*" required />
      </div>
      <fieldset className="creator-fieldset creator-choice-set">
        <legend>Restrictions</legend>
        <label>
          <input
            type="radio"
            name="creator-group-visibility"
            value="invite"
            checked={visibility === 'invite'}
            onChange={() => setVisibility('invite')}
          />
          <span>Invite only</span>
        </label>
        <label>
          <input
            type="radio"
            name="creator-group-visibility"
            value="open"
            checked={visibility === 'open'}
            onChange={() => setVisibility('open')}
          />
          <span>Open to all</span>
        </label>
      </fieldset>
      {visibility === 'open' ? (
        <div className="creator-form-grid">
          <div className="form-row">
            <label htmlFor="creator-group-level">Who can join: level *</label>
            <select id="creator-group-level" required defaultValue={readDraftField(draft, 'creator-group-level')}>
              <option value="" disabled>Select level</option>
              {GROUP_LEVELS.map((level) => <option key={level} value={level}>Level {level}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="creator-group-program">Who can join: program *</label>
            <select id="creator-group-program" required defaultValue={readDraftField(draft, 'creator-group-program')}>
              <option value="" disabled>Select program</option>
              {programs.map((program) => (
                <option key={program.id || program.name} value={program.name}>{program.name}</option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
    </>
  );
}

function SurvivalGuideForm({ draft }) {
  const [readingMinutes, setReadingMinutes] = useState(() => readDraftField(draft, 'creator-reading-minutes'));
  const [paragraphs, setParagraphs] = useState(() => getDraftParagraphs(draft, 'guide'));

  return (
    <>
      <div className="form-row">
        <label htmlFor="creator-guide-title">Guide title *</label>
        <input id="creator-guide-title" type="text" required defaultValue={readDraftField(draft, 'creator-guide-title')} />
      </div>
      <div className="creator-form-grid">
        <ReadingMinutesSelect value={readingMinutes} onChange={setReadingMinutes} />
        <div className="form-row">
          <label htmlFor="creator-guide-date">Date published *</label>
          <input id="creator-guide-date" type="date" required defaultValue={readDraftField(draft, 'creator-guide-date')} />
        </div>
      </div>
      <FileUploadField id="creator-guide-image" label="Main image" accept="image/*" required />
      <ParagraphFields groupKey="guide" paragraphs={paragraphs} onChange={setParagraphs} sectionLabel="Guide content" />
    </>
  );
}

function LongEdutainmentForm({ draft, kind }) {
  const [readingMinutes, setReadingMinutes] = useState(() => readDraftField(draft, 'creator-reading-minutes'));
  const titleLabel = `${kind.charAt(0).toUpperCase()}${kind.slice(1)} title`;
  const [sections, setSections] = useState({
    intro: getDraftParagraphs(draft, 'intro'),
    main: getDraftParagraphs(draft, 'main'),
    conclusion: getDraftParagraphs(draft, 'conclusion'),
  });

  const updateSection = (name, paragraphs) => {
    setSections((current) => ({ ...current, [name]: paragraphs }));
  };

  return (
    <>
      <div className="form-row">
        <label htmlFor={`creator-${kind}-title`}>{titleLabel} *</label>
        <input id={`creator-${kind}-title`} type="text" required defaultValue={readDraftField(draft, `creator-${kind}-title`)} />
      </div>
      <div className="creator-form-grid">
        <ReadingMinutesSelect value={readingMinutes} onChange={setReadingMinutes} />
        <div className="form-row">
          <label htmlFor={`creator-${kind}-date`}>Date published *</label>
          <input id={`creator-${kind}-date`} type="date" required defaultValue={readDraftField(draft, `creator-${kind}-date`)} />
        </div>
      </div>
      <FileUploadField id={`creator-${kind}-image`} label="Main image" accept="image/*" required />
      <ParagraphFields groupKey="intro" paragraphs={sections.intro} onChange={(paragraphs) => updateSection('intro', paragraphs)} sectionLabel="Intro" />
      <ParagraphFields groupKey="main" paragraphs={sections.main} onChange={(paragraphs) => updateSection('main', paragraphs)} sectionLabel="Main" />
      <ParagraphFields groupKey="conclusion" paragraphs={sections.conclusion} onChange={(paragraphs) => updateSection('conclusion', paragraphs)} sectionLabel="Conclusion" />
    </>
  );
}

function ShortEdutainmentForm({ draft, title }) {
  return (
    <>
      <div className="form-row">
        <label htmlFor={`creator-${title}-content`}>Content *</label>
        <textarea
          className="creator-short-content"
          id={`creator-${title}-content`}
          rows={2}
          required
          defaultValue={readDraftField(draft, `creator-${title}-content`)}
        />
      </div>
      <FileUploadField id={`creator-${title}-image`} label="Content image (optional)" accept="image/*" />
    </>
  );
}

export default function CreatorSubmissionModal({ creatorType, draft, onClose, onDraftSaved }) {
  const { user, isAuthenticated } = useAuth();
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    setFeedback('');
  }, [creatorType?.id]);

  const subtitle = useMemo(() => {
    if (!creatorType) return '';
    return `Fill the ${creatorType.title.toLowerCase()} details before it enters creator review.`;
  }, [creatorType]);

  const modalTitle = useMemo(() => {
    if (!creatorType) return 'Create';
    if (creatorType.id === 'file') return 'Upload Files';
    if (creatorType.id === 'video') return 'Upload Video Lesson';
    return `Create ${creatorType.title}`;
  }, [creatorType]);

  const renderFormFields = () => {
    switch (creatorType?.id) {
      case 'file':
        return <FileForm draft={draft} />;
      case 'video':
        return <VideoForm draft={draft} />;
      case 'study-group':
        return <StudyGroupForm draft={draft} />;
      case 'survival-guide':
        return <SurvivalGuideForm draft={draft} />;
      case 'article':
        return <LongEdutainmentForm draft={draft} kind="article" />;
      case 'story':
        return <LongEdutainmentForm draft={draft} kind="story" />;
      case 'quote':
      case 'did-you-know':
      case 'joke':
        return <ShortEdutainmentForm draft={draft} title={creatorType.id} />;
      default:
        return null;
    }
  };

  const openAuthModal = () => {
    window.dispatchEvent(new CustomEvent('openAuthModal', { detail: 'login' }));
    onClose?.();
  };

  return (
    <FormModal
      isOpen={Boolean(creatorType)}
      onClose={onClose}
      size="lg"
      title={modalTitle}
      subtitle={subtitle}
      modalClassName="creator-submission-modal"
    >
      {!isAuthenticated ? (
        <div className="creator-auth-required">
          <p>You need to sign in before uploading or submitting creator content.</p>
          <div className="fm-actions creator-form-actions">
            <button className="btn btn-primary" type="button" onClick={openAuthModal}>
              Sign in
            </button>
            <button className="btn btn-secondary" type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <form
          key={draft?.id || creatorType?.id}
          className="creator-submission-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!isAuthenticated) {
              openAuthModal();
              return;
            }
            setFeedback('The form is ready for the review submission endpoint.');
          }}
        >
          <CreatorTypeBanner creatorType={creatorType} />
          <FormContactIdentity user={user} label="Creator info" />
          {draft ? (
            <p className="creator-draft-note">
              Draft fields were restored. Reattach uploaded files and images before submitting for review.
            </p>
          ) : null}
          {renderFormFields()}
          {feedback ? <p className="creator-review-feedback">{feedback}</p> : null}
          <div className="fm-actions creator-form-actions">
            <button className="btn btn-primary" type="submit">Submit for review</button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={(event) => {
                const savedDrafts = saveCreatorDraft({
                  id: draft?.id || `${creatorType.id}-${Date.now()}`,
                  creatorTypeId: creatorType.id,
                  creatorTypeTitle: creatorType.title,
                  title: getDraftHeading(creatorType, event.currentTarget.form),
                  savedAt: new Date().toISOString(),
                  fields: collectDraftFields(event.currentTarget.form),
                  paragraphGroups: collectParagraphGroups(event.currentTarget.form),
                });
                onDraftSaved?.(savedDrafts);
                setFeedback('Draft saved on this device. Reopen it from Drafts to keep editing.');
              }}
            >
              Save as draft
            </button>
            <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      )}
    </FormModal>
  );
}
