import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiEye, FiPlayCircle, FiTrash2, FiVideo } from 'react-icons/fi';
import api from '../../services/api';
import { useUser } from './UserContext';
import SearchBar from './SearchBar';
import { lockBodyScroll } from '../../utils/bodyScrollLock';
import LearnHorizontalSlider from '../shared/listPage/HorizontalSlider';
import '../learn/Learn.css';
import './Eduvhibe.css';

const EDUVHIBE_LEVELS = ['100', '200', '300', '400'];

export default function VideosTab() {
  const { isAdmin } = useUser();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [level, setLevel] = useState('100');

  const filterOptions = [
    { value: 'all', label: 'All Levels' },
    { value: '100', label: 'Level 100' },
    { value: '200', label: 'Level 200' },
    { value: '300', label: 'Level 300' },
    { value: '400', label: 'Level 400' }
  ];

  const getYouTubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu\.be\/|shorts\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const getYouTubeEmbedUrl = (url) => {
    const videoId = getYouTubeId(url);
    return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1` : null;
  };

  const normalizeLevel = (value) => {
    const match = String(value || '').match(/\d{3}/);
    return match ? match[0] : '100';
  };

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const response = await api.eduvhibe.getVideos();
      setVideos(response?.videos || []);
    } catch (error) {
      console.error('Error fetching videos:', error);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  useEffect(() => {
    if (!activeVideo) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setActiveVideo(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const releaseBodyScroll = lockBodyScroll();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      releaseBodyScroll();
    };
  }, [activeVideo]);

  const handleAddVideo = async (event) => {
    event.preventDefault();
    if (!isAdmin) return;
    if (!title || !videoUrl) return alert('Title and YouTube URL are required.');
    if (!getYouTubeId(videoUrl)) return alert('Please enter a valid YouTube URL.');

    setAdding(true);
    try {
      const response = await api.eduvhibe.createVideo({
        title,
        description,
        video_url: videoUrl,
        level
      });

      if (response?.video) {
        setVideos((prev) => [response.video, ...prev]);
      } else {
        await fetchVideos();
      }

      alert('Video added successfully!');
      setShowAddForm(false);
      setTitle('');
      setDescription('');
      setVideoUrl('');
      setLevel('100');
    } catch (error) {
      console.error('Error adding video:', error);
      alert('Failed to add video.');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteVideo = async (id) => {
    if (!isAdmin) return;
    if (!window.confirm('Are you sure you want to delete this video?')) return;

    try {
      await api.eduvhibe.deleteVideo(id);
      setVideos((prev) => prev.filter((video) => video.id !== id));
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete video.');
    }
  };

  const filteredVideos = videos.filter((video) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchLower || video.title?.toLowerCase().includes(searchLower);
    const matchesLevel = selectedFilter === 'all' || normalizeLevel(video.level) === selectedFilter;
    return matchesSearch && matchesLevel;
  });

  const videoSections = useMemo(
    () =>
      EDUVHIBE_LEVELS
        .map((levelKey) => ({
          key: levelKey,
          title: `Level ${levelKey} Videos`,
          items: filteredVideos.filter((video) => normalizeLevel(video.level) === levelKey),
        }))
        .filter((section) => selectedFilter === 'all' || section.key === selectedFilter),
    [filteredVideos, selectedFilter]
  );

  const renderVideoCard = (video) => {
    const videoId = getYouTubeId(video.video_url);
    const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
    const views = Number(video.views || video.view_count || 0);

    return (
      <article key={video.id} className="eduvhibe-video-slider-card" role="listitem">
        <div className="eduvhibe-video-slider-media">
          {thumbnailUrl ? (
            <button
              type="button"
              className="eduvhibe-video-thumb-button"
              onClick={() => setActiveVideo(video)}
              aria-label={`Watch ${video.title} in Learnda`}
            >
              <img src={thumbnailUrl} alt={video.title} loading="lazy" decoding="async" />
              <span className="eduvhibe-video-play-chip">
                <FiPlayCircle />
                Watch
              </span>
            </button>
          ) : (
            <button
              type="button"
              className="eduvhibe-invalid-video eduvhibe-invalid-video-button"
              onClick={() => setActiveVideo(video)}
            >
              Invalid Video Link
            </button>
          )}
        </div>

        <div className="eduvhibe-video-slider-body">
          <h3 title={video.title}>{video.title}</h3>
          <div className="eduvhibe-video-title-sep" aria-hidden="true" />
          <div className="eduvhibe-video-slider-meta">
            <span><FiVideo /> Level {normalizeLevel(video.level)}</span>
            {video.semester ? <span>Sem {video.semester}</span> : null}
            {video.course_code ? <span>{video.course_code}</span> : null}
            <span><FiEye /> {views.toLocaleString()}</span>
          </div>
          {video.description ? <p>{video.description}</p> : null}
          <div className="eduvhibe-video-slider-actions">
            <button type="button" className="eduvhibe-video-slider-action is-primary" onClick={() => setActiveVideo(video)}>
              <FiPlayCircle />
              Play
            </button>
            {isAdmin ? (
              <button
                type="button"
                className="eduvhibe-video-slider-action is-danger"
                onClick={() => handleDeleteVideo(video.id)}
                title="Delete Video"
              >
                <FiTrash2 />
              </button>
            ) : null}
          </div>
        </div>
      </article>
    );
  };

  const videoModal = activeVideo ? (
    <div
      className="eduvhibe-video-modal-backdrop"
      role="presentation"
      onMouseDown={() => setActiveVideo(null)}
    >
      <section
        className="eduvhibe-video-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Now playing ${activeVideo.title}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="eduvhibe-video-modal-header">
          <div className="eduvhibe-video-modal-title-row">
            <img
              className="eduvhibe-video-modal-logo"
              src={`${import.meta.env.BASE_URL}learnda-logo.webp`}
              alt="Learnda"
            />
            <div className="eduvhibe-video-modal-copy">
              <span className="eduvhibe-video-modal-kicker">Now playing in Learnda</span>
              <h3>{activeVideo.title}</h3>
            </div>
          </div>
          <button
            type="button"
            className="eduvhibe-video-modal-close"
            onClick={() => setActiveVideo(null)}
            aria-label="Close video"
          >
            x
          </button>
        </div>

        <div className="eduvhibe-video-player-frame">
          <iframe
            src={getYouTubeEmbedUrl(activeVideo.video_url)}
            title={activeVideo.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </section>
    </div>
  ) : null;

  return (
    <>
    <div className="edu-section-shell eduvhibe-section eduvhibe-videos-tab">
      <div className="edu-section-head eduvhibe-section-head">
        <div className="eduvhibe-section-copy">
          <h2 className="eduvhibe-section-title">Video Resources</h2>
          <p className="eduvhibe-section-subtitle">Curated tutorials for your studies.</p>
        </div>

        {isAdmin && (
          <button
            className="edu-section-action"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? 'Cancel' : '+ Add Video'}
          </button>
        )}
      </div>

      <SearchBar
        placeholder="Search videos by title..."
        onSearch={(value) => { setSearchQuery(value); }}
        onFilter={(value) => { setSelectedFilter(value); }}
        filterOptions={filterOptions}
      />

      {isAdmin && showAddForm && (
        <div className="cgpa-card eduvhibe-admin-panel">
          <h3 className="eduvhibe-admin-title">Add New YouTube Video</h3>
          <form onSubmit={handleAddVideo} className="eduvhibe-admin-form">
            <div className="eduvhibe-form-row">
              <input
                type="text"
                placeholder="Video Title"
                required
                className="cgpa-input eduvhibe-form-wide"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />

              <select className="cgpa-input" value={level} onChange={(event) => setLevel(event.target.value)}>
                <option value="100">Level 100</option>
                <option value="200">Level 200</option>
                <option value="300">Level 300</option>
                <option value="400">Level 400</option>
              </select>
            </div>

            <input
              type="text"
              placeholder="Paste YouTube Link here..."
              required
              className="cgpa-input"
              value={videoUrl}
              onChange={(event) => setVideoUrl(event.target.value)}
            />

            <input
              type="text"
              placeholder="Short description..."
              className="cgpa-input"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />

            <button
              type="submit"
              disabled={adding}
              className="eduvhibe-submit-btn"
            >
              {adding ? 'Adding Video...' : 'Post Video'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="eduvhibe-state-message">Loading videos...</div>
      ) : filteredVideos.length === 0 ? (
        <div className="eduvhibe-empty-state">
          <h3>No videos found.</h3>
        </div>
      ) : (
        <>
          <div className="eduvhibe-level-sections">
            {videoSections.map((section) => (
              <section className="learn-section eduvhibe-level-section" key={section.key} aria-label={section.title}>
                <div className="learn-section-head">
                  <h2>{section.title}</h2>
                  <span>{section.items.length}</span>
                </div>
                {section.items.length ? (
                  <LearnHorizontalSlider ariaLabel={`${section.title} slider`} autoSlide={section.items.length > 4}>
                    {section.items.map((video) => renderVideoCard(video))}
                  </LearnHorizontalSlider>
                ) : (
                  <p className="learn-section-empty">No videos available for this level.</p>
                )}
              </section>
            ))}
          </div>
        </>
      )}

    </div>
    {typeof document !== 'undefined' && videoModal ? createPortal(videoModal, document.body) : videoModal}
    </>
  );
}
