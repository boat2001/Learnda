import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiArchive, FiDownload, FiEye, FiFileText, FiHardDrive, FiImage, FiMusic, FiVideo } from 'react-icons/fi';
import api from '../../services/api';
import { useUser } from './UserContext';
import SearchBar from './SearchBar';
import { saveBlobAsFile, withDownloadLock } from '../../utils/downloadManager';
import ResourceFilePreviewModal from '../../components/resources/ResourceFilePreviewModal';
import DownloadCountdownModal from '../../components/resources/DownloadCountdownModal';
import LearnHorizontalSlider from '../shared/listPage/HorizontalSlider';
import '../learn/Learn.css';
import '../PLS/PLS.css';
import '../Resources/ResourcesDashboard.css';
import './Eduvhibe.css';

const EDUVHIBE_LEVELS = ['100', '200', '300', '400'];

export default function NotesTab() {
  const { isAdmin } = useUser();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewNote, setPreviewNote] = useState(null);
  const [pendingDownloadNote, setPendingDownloadNote] = useState(null);
  const [downloadingNoteId, setDownloadingNoteId] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('100');
  const [selectedFile, setSelectedFile] = useState(null);

  const filterOptions = [
    { value: 'all', label: 'All Levels' },
    { value: '100', label: 'Level 100' },
    { value: '200', label: 'Level 200' },
    { value: '300', label: 'Level 300' },
    { value: '400', label: 'Level 400' }
  ];

  const getFileKind = (note) => {
    const fileType = (note.file_type || '').toLowerCase();
    const name = (note.file_name || note.title || '').toLowerCase();
    if (fileType.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
    if (fileType.includes('word') || name.endsWith('.doc') || name.endsWith('.docx')) return 'doc';
    if (fileType.includes('powerpoint') || name.endsWith('.ppt') || name.endsWith('.pptx')) return 'ppt';
    if (fileType.includes('image')) return 'image';
    if (fileType.includes('video')) return 'video';
    if (fileType.includes('audio')) return 'audio';
    if (fileType.includes('zip')) return 'zip';
    return 'file';
  };

  const getQuestionTone = (note) => {
    const text = `${note.title || ''} ${note.description || ''}`.toLowerCase();
    if (/quiz|question/.test(text)) return 'quiz';
    if (/outline|lesson plan|syllabus|curriculum/.test(text)) return 'outline';
    if (/answer|solution/.test(text)) return 'answer';
    return 'exam';
  };

  const getNoteType = (note) => {
    const kind = getFileKind(note);
    if (kind === 'ppt') return 'Slides';
    if (kind === 'doc') return 'Doc';
    if (/quiz|question/i.test(`${note.title || ''} ${note.description || ''}`)) return 'Quiz';
    if (/exam|assessment/i.test(`${note.title || ''} ${note.description || ''}`)) return 'Exam';
    return 'Note';
  };

  const getFileIcon = (note) => {
    const kind = getFileKind(note);
    if (kind === 'image') return <FiImage />;
    if (kind === 'video') return <FiVideo />;
    if (kind === 'audio') return <FiMusic />;
    if (kind === 'zip') return <FiArchive />;
    return <FiFileText />;
  };

  const formatFileSize = (value) => {
    if (value === null || value === undefined || value === '') return 'N/A';
    if (typeof value === 'string') return value;
    if (!Number.isFinite(value) || value <= 0) return 'N/A';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.min(sizes.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
    return `${(value / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const normalizeLevel = (value) => {
    const match = String(value || '').match(/\d{3}/);
    return match ? match[0] : '100';
  };

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const response = await api.eduvhibe.getNotes();
      setNotes(response?.notes || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
      setNotes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleDeleteNote = async (id) => {
    if (!isAdmin) return;
    if (!window.confirm('Are you sure you want to delete this note permanently?')) return;

    try {
      await api.eduvhibe.deleteNote(id);
      setNotes((prev) => prev.filter((note) => note.id !== id));
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Delete failed. Please try again.');
    }
  };

  const handleUploadSubmit = async (event) => {
    event.preventDefault();
    if (!isAdmin) return;
    if (!selectedFile) return alert('Error: Please select a file.');
    if (!title) return alert('Please provide a title.');

    const sizeLimit = 50 * 1024 * 1024;
    if (selectedFile.size > sizeLimit) {
      alert('File is too large. Please upload files smaller than 50MB.');
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('level', level);
    formData.append('file', selectedFile);

    setUploading(true);
    try {
      const response = await api.eduvhibe.uploadNote(formData);
      if (response?.note) {
        setNotes((prev) => [response.note, ...prev]);
      } else {
        await fetchNotes();
      }
      alert('Note uploaded successfully!');
      setShowUploadForm(false);
      setTitle('');
      setDescription('');
      setLevel('100');
      setSelectedFile(null);
    } catch (error) {
      console.error('Upload process failed:', error);
      alert(`Failed to upload: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadNote = (note) => {
    setPendingDownloadNote(note);
  };

  const handleViewNote = (note) => {
    setPreviewNote({ id: note.id, fileName: note.file_name, title: note.title });
  };

  const executeNoteDownload = useCallback(
    async (note) => {
      if (!note) return;
      await withDownloadLock(
        async () => {
          setDownloadingNoteId(note.id);
          try {
            const blob = await api.eduvhibe.downloadNote(note.id);
            saveBlobAsFile(blob, note.file_name || `${note.title}.pdf`);
            setPendingDownloadNote(null);
          } catch (error) {
            console.error('Download failed:', error);
            alert('Failed to download note.');
          } finally {
            setDownloadingNoteId(null);
          }
        },
        () => alert('Finish the current download before starting another.')
      );
    },
    []
  );

  const filteredNotes = notes.filter((note) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      note.title?.toLowerCase().includes(searchLower) ||
      note.description?.toLowerCase().includes(searchLower);
    const matchesLevel = selectedFilter === 'all' || normalizeLevel(note.level) === selectedFilter;
    return matchesSearch && matchesLevel;
  });

  const noteSections = useMemo(
    () =>
      EDUVHIBE_LEVELS
        .map((levelKey) => ({
          key: levelKey,
          title: `Level ${levelKey} Notes`,
          items: filteredNotes.filter((note) => normalizeLevel(note.level) === levelKey),
        }))
        .filter((section) => selectedFilter === 'all' || section.key === selectedFilter),
    [filteredNotes, selectedFilter]
  );

  const renderNoteCard = (note) => {
    const tone = getQuestionTone(note);
    const noteType = getNoteType(note);
    const fileKind = getFileKind(note).toUpperCase();
    const views = Number(note.views || 0);
    const downloads = Number(note.downloads || 0);

    return (
      <article key={note.id} className={`pls-file-item resources-file-item pls-file-item-${tone}`} role="listitem">
        <div className="pls-file-row-top">
          <div className={`pls-file-icon pls-file-icon-${tone}`} aria-hidden="true">
            {getFileIcon(note)}
          </div>
          <div className="pls-file-top-meta">
            <span className={`pls-file-top-pill pls-file-top-pill-${tone}`}>{noteType}</span>
            <span className="pls-file-top-pill pls-file-top-pill-uploader" title={note.course || 'Eduvhibe Notes'}>
              {note.course || 'Eduvhibe Notes'}
            </span>
          </div>
        </div>

        <div className="pls-file-divider" aria-hidden="true" />

        <p className="pls-file-course" title={note.title || 'Untitled note'}>
          {note.title || 'Untitled note'}
        </p>

        <div className="pls-file-row-split">
          <span className="pls-file-pill">{note.semester ? `Sem ${note.semester}` : fileKind}</span>
          <span className="pls-file-pill">L{normalizeLevel(note.level)}</span>
        </div>

        <div className="pls-file-stats">
          <span className="pls-file-stat">
            <FiDownload />
            {downloads.toLocaleString()}
          </span>
          <span className="pls-file-stat">
            <FiEye />
            {views.toLocaleString()}
          </span>
          <span className="pls-file-stat">
            <FiHardDrive />
            {formatFileSize(note.file_size)}
          </span>
        </div>

        <div className="pls-file-divider" aria-hidden="true" />

        <div className="pls-file-actions">
          <button
            type="button"
            className="pls-file-action"
            onClick={() => handleDownloadNote(note)}
            disabled={Boolean(downloadingNoteId)}
          >
            <FiDownload />
            <span>{downloadingNoteId === note.id ? 'Downloading...' : 'Download'}</span>
          </button>
          <button
            type="button"
            className="pls-file-action"
            onClick={() => handleViewNote(note)}
          >
            <FiEye />
            <span>View</span>
          </button>
        </div>

        {isAdmin ? (
          <button
            type="button"
            className="eduvhibe-note-file-action is-danger"
            style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
            onClick={() => handleDeleteNote(note.id)}
          >
            Delete
          </button>
        ) : null}
      </article>
    );
  };

  return (
    <div className="edu-section-shell eduvhibe-section eduvhibe-notes-tab">
      <div className="edu-section-head eduvhibe-section-head">
        <div className="eduvhibe-section-copy">
          <h2 className="eduvhibe-section-title">Course Notes & PDFs</h2>
          <p className="eduvhibe-section-subtitle">Download materials for your semester.</p>
        </div>

        {isAdmin && (
          <button
            className="edu-section-action"
            onClick={() => setShowUploadForm(!showUploadForm)}
          >
            {showUploadForm ? 'Cancel Upload' : '+ Upload Note'}
          </button>
        )}
      </div>

      <SearchBar
        placeholder="Search notes by title or topic..."
        onSearch={(value) => { setSearchQuery(value); }}
        onFilter={(value) => { setSelectedFilter(value); }}
        filterOptions={filterOptions}
      />

      {isAdmin && showUploadForm && (
        <div className="cgpa-card eduvhibe-admin-panel">
          <h3 className="eduvhibe-admin-title">Admin: Upload New Material</h3>
          <form onSubmit={handleUploadSubmit} className="eduvhibe-admin-form">
            <div className="eduvhibe-form-row">
              <input type="text" placeholder="Note Title" required className="cgpa-input eduvhibe-form-wide"
                value={title} onChange={(event) => setTitle(event.target.value)} />

              <select className="cgpa-input" value={level} onChange={(event) => setLevel(event.target.value)}>
                <option value="100">Level 100</option>
                <option value="200">Level 200</option>
                <option value="300">Level 300</option>
                <option value="400">Level 400</option>
              </select>
            </div>

            <input type="text" placeholder="Short description..." className="cgpa-input"
              value={description} onChange={(event) => setDescription(event.target.value)} />

            <input
              type="file" required className="cgpa-input"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
            />

            <button type="submit" disabled={uploading} className="eduvhibe-submit-btn">
              {uploading ? 'Uploading (Please wait)...' : 'Upload to Database'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="eduvhibe-state-message">Loading course materials...</div>
      ) : filteredNotes.length === 0 ? (
        <div className="eduvhibe-empty-state">
          <h3>No notes found.</h3>
        </div>
      ) : (
        <>
          <div className="eduvhibe-level-sections resources-redesign">
            {noteSections.map((section) => (
              <section className="learn-section eduvhibe-level-section" key={section.key} aria-label={section.title}>
                <div className="learn-section-head">
                  <h2>{section.title}</h2>
                  <span>{section.items.length}</span>
                </div>
                {section.items.length ? (
                  <LearnHorizontalSlider ariaLabel={`${section.title} slider`} autoSlide={section.items.length > 4}>
                    {section.items.map((note) => renderNoteCard(note))}
                  </LearnHorizontalSlider>
                ) : (
                  <p className="learn-section-empty">No notes available for this level.</p>
                )}
              </section>
            ))}
          </div>
        </>
      )}
      <ResourceFilePreviewModal
        open={Boolean(previewNote)}
        file={previewNote}
        onClose={() => setPreviewNote(null)}
        fetchBlob={() => api.eduvhibe.downloadNote(previewNote.id)}
      />

      <DownloadCountdownModal
        open={Boolean(pendingDownloadNote)}
        fileName={pendingDownloadNote?.file_name || pendingDownloadNote?.title || 'note'}
        isProcessing={Boolean(downloadingNoteId)}
        onCancel={() => {
          if (!downloadingNoteId) setPendingDownloadNote(null);
        }}
        onConfirm={() => executeNoteDownload(pendingDownloadNote)}
      />
    </div>
  );
}
