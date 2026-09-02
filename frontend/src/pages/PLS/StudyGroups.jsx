import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useAnalyticsWithContext } from '../../hooks/useAnalytics';
import { Link, useNavigate } from 'react-router-dom';
import { FiClock, FiLayers, FiSearch, FiUsers, FiZap } from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../hooks/useSubscription';
import useHeaderSheen from '../../hooks/useHeaderSheen';
import usePLS from '../../hooks/usePLS';
import api from '../../services/api';
import { getPlanTierClass } from '../../utils/planTheme';
import LearnFilterDropdown from '../shared/listPage/FilterDropdown';
import LearnHorizontalSlider from '../shared/listPage/HorizontalSlider';
import useIncrementalResults from '../shared/listPage/useIncrementalResults';
import { playListPageToggleSound } from '../shared/listPage/toggleSound';
import '../learn/Learn.css';
import './StudyGroups.css';

const SECTION_LIMIT = 12;
const QUOTE = 'Alone we go faster, together we go further.';
const QUOTE_AUTHOR = 'African Proverb';

const BASE_ASSET = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
const GROUP_IMAGE_FALLBACK = `${BASE_ASSET}group-1.jpg`;

const toText = (value) => String(value ?? '').trim();
const normalizeText = (value) => toText(value).toLowerCase();

const initialsFor = (title = '') =>
  title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || '')
    .join('') || 'G';

const formatRelative = (iso) => {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return '';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString();
};

// "class" / "level" audience badge text — only for non-official groups.
const audienceBadge = (group) => {
  const type = String(group.audience_type || '').toLowerCase();
  const label = toText(group.audience_label);
  if (!label) return '';
  if (type === 'class') return `Class: ${label}`;
  if (type === 'level') return `Level: ${label}`;
  return label;
};

function GroupAvatar({ group }) {
  const [errored, setErrored] = useState(false);
  const src = group.avatar_url || group.image_url || GROUP_IMAGE_FALLBACK;
  const showImage = src && !errored;
  return (
    <div
      className={`sg-card-avatar ${group.is_joined ? 'is-joined' : ''} ${group.is_official ? 'is-official' : 'is-custom'}`}
      aria-hidden="true"
    >
      {showImage ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setErrored(true)} />
      ) : (
        <span className="sg-card-avatar-initials">{initialsFor(group.title)}</span>
      )}
      {group.is_joined ? <span className="sg-card-pill">Joined</span> : null}
    </div>
  );
}

function GroupCard({ group, onJoin, joining }) {
  const memberCount = Number(group.member_count || 0);
  const activeCount = Number(group.active_members || memberCount || 0);
  const courseLabel = toText(group.course_name || group.course_code);
  const audienceText = audienceBadge(group);
  const lastInteracted = formatRelative(group.last_message_at || group.last_activity_at);
  const showCourseLine = !group.is_official && courseLabel;

  const handleJoinClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (joining) return;
    onJoin(group);
  };

  return (
    <Link
      to={`/groups/${group.id}`}
      className={`sg-card ${group.is_joined ? 'sg-card--joined' : ''}`}
      role="listitem"
      aria-label={`${group.title}. ${memberCount} members.`}
    >
      <GroupAvatar group={group} />

      <strong className="sg-card-title" title={group.title}>{group.title}</strong>

      {showCourseLine ? (
        <p className="sg-card-course" title={courseLabel}>{courseLabel}</p>
      ) : null}

      {audienceText ? (
        <p className="sg-card-audience">
          <FiLayers aria-hidden /> {audienceText}
        </p>
      ) : null}

      <div className="sg-card-stats">
        <span className="sg-card-stat" title={`${memberCount.toLocaleString()} members`}>
          <FiUsers aria-hidden /> {memberCount.toLocaleString()}
        </span>
        <span className="sg-card-stat" title={`${activeCount.toLocaleString()} active`}>
          <FiZap aria-hidden /> {activeCount.toLocaleString()}
        </span>
      </div>

      <p className="sg-card-last">
        <FiClock aria-hidden />
        <span>{lastInteracted ? `Last active ${lastInteracted}` : 'No activity yet'}</span>
      </p>

      <div className="sg-card-action">
        {group.is_joined ? (
          <span className="sg-card-cta">Open chat →</span>
        ) : (
          <button
            type="button"
            className="sg-card-join-btn"
            onClick={handleJoinClick}
            disabled={joining}
          >
            {joining ? 'Joining…' : 'Join group'}
          </button>
        )}
      </div>
    </Link>
  );
}

function GroupSkeletonCard({ keyName }) {
  return (
    <div key={keyName} className="sg-card sg-card--skeleton" aria-hidden="true">
      <div className="sg-card-avatar shimmer-block" />
      <span className="sg-skeleton-line sg-skeleton-line-title shimmer-block" />
      <span className="sg-skeleton-line sg-skeleton-line-meta shimmer-block" />
      <div className="sg-card-stats sg-skeleton-stats">
        <span className="shimmer-block" />
        <span className="shimmer-block" />
      </div>
      <span className="sg-skeleton-line sg-skeleton-line-meta shimmer-block" />
    </div>
  );
}

const skeletonRow = (prefix, count = 6) =>
  Array.from({ length: count }).map((_, index) => (
    <GroupSkeletonCard keyName={`${prefix}-${index}`} key={`${prefix}-${index}`} />
  ));

export default function StudyGroupsListing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentPlan } = useSubscription();
  const { headerSheenReady, headerSheenCycle } = useHeaderSheen();
  const { refreshPLS } = usePLS();
  const { trackEvent } = useAnalyticsWithContext();

  const planTierClass = getPlanTierClass(currentPlan?.name || user?.current_plan || 'Basic Student');

  const [sections, setSections] = useState({ joined: [], related: [], most_active: [], recently_added: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joiningId, setJoiningId] = useState(null);

  const [discoveryMode, setDiscoveryMode] = useState('search');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    membership: 'all',
    activity: 'all',
  });
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deferredFilters = useDeferredValue(filters);

  const loadSections = useCallback(async () => {
    setError('');
    try {
      const res = await api.studyGroups.discover({ limit: SECTION_LIMIT });
      if (!res?.success) {
        setError(res?.error || 'Could not load study groups right now.');
        return;
      }
      const next = res.data?.sections || {};
      setSections({
        joined: next.joined || [],
        related: next.related || [],
        most_active: next.most_active || [],
        recently_added: next.recently_added || [],
      });
    } catch (e) {
      setError(e?.message || 'Could not load study groups right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadSections();
  }, [loadSections]);

  const handleJoin = useCallback(async (group) => {
    if (!group?.id) return;
    setJoiningId(group.id);
    try {
      const res = await api.studyGroups.join(group.id);
      if (res?.success) {
        trackEvent('study_group_joined', { group_id: group.id, group_name: group.name });
        refreshPLS?.().catch(() => {});
        navigate(`/groups/${group.id}`);
        return;
      }
      setError(res?.error || 'Could not join this group.');
    } catch (e) {
      setError(e?.message || 'Could not join this group.');
    } finally {
      setJoiningId(null);
    }
  }, [navigate, refreshPLS, trackEvent]);

  const handleDiscoveryModeChange = useCallback((nextMode) => {
    if (nextMode === discoveryMode) return;
    playListPageToggleSound('toggle');
    setDiscoveryMode(nextMode);
  }, [discoveryMode]);

  const allGroupsFlat = useMemo(() => {
    const seen = new Set();
    const merged = [];
    [sections.joined, sections.related, sections.most_active, sections.recently_added].forEach((bucket) => {
      (bucket || []).forEach((group) => {
        const key = String(group.id);
        if (seen.has(key)) return;
        seen.add(key);
        merged.push(group);
      });
    });
    return merged;
  }, [sections]);

  const searchMatches = useMemo(() => {
    const q = normalizeText(deferredSearchQuery);
    if (!q) return [];
    return allGroupsFlat.filter((group) => {
      const haystack = normalizeText(`${group.title} ${group.course_name || ''} ${group.course_code || ''}`);
      return haystack.includes(q);
    });
  }, [allGroupsFlat, deferredSearchQuery]);

  const filterMatches = useMemo(() => {
    return allGroupsFlat.filter((group) => {
      if (deferredFilters.membership === 'joined' && !group.is_joined) return false;
      if (deferredFilters.membership === 'available' && group.is_joined) return false;
      if (deferredFilters.activity === 'active' && (group.member_count || 0) < 5) return false;
      if (deferredFilters.activity === 'fresh') {
        const isRecent = sections.recently_added.some((g) => String(g.id) === String(group.id));
        if (!isRecent) return false;
      }
      return true;
    });
  }, [allGroupsFlat, deferredFilters, sections.recently_added]);

  const hasSearchQuery = useMemo(() => Boolean(normalizeText(searchQuery)), [searchQuery]);
  const hasActiveFilters = useMemo(
    () => filters.membership !== 'all' || filters.activity !== 'all',
    [filters]
  );

  const interactionResults = useMemo(
    () => (discoveryMode === 'search' ? searchMatches : filterMatches),
    [discoveryMode, filterMatches, searchMatches]
  );

  const shouldShowInteractionResults = useMemo(
    () => (discoveryMode === 'search' ? hasSearchQuery : hasActiveFilters),
    [discoveryMode, hasActiveFilters, hasSearchQuery]
  );
  const visibleInteractionResults = useIncrementalResults(interactionResults, {
    active: shouldShowInteractionResults,
  });

  const showcasedSections = useMemo(
    () => [
      {
        key: 'joined',
        title: 'Groups You Joined',
        items: sections.joined,
        empty: 'You will appear here as soon as you join your first group.',
      },
      {
        key: 'related',
        title: 'Related Groups',
        items: sections.related,
        empty: 'No related groups yet — your program groups will land here.',
      },
      {
        key: 'most-active',
        title: 'Most Active Groups',
        items: sections.most_active,
        empty: 'Activity rankings update once members start chatting.',
      },
      {
        key: 'recently-added',
        title: 'Recently Added Groups',
        items: sections.recently_added,
        empty: 'No new groups in the last few days.',
      },
    ],
    [sections]
  );

  const renderSliderRow = (section) => {
    if (loading) {
      return (
        <LearnHorizontalSlider ariaLabel={`${section.title} slider loading`}>
          {skeletonRow(`${section.key}-skeleton`)}
        </LearnHorizontalSlider>
      );
    }
    if (!section.items.length) {
      return <p className="learn-section-empty">{section.empty}</p>;
    }
    return (
      <LearnHorizontalSlider ariaLabel={`${section.title} slider`} autoSlide={section.key === 'most-active'}>
        {section.items.map((group) => (
          <GroupCard
            key={`${section.key}-${group.id}`}
            group={group}
            onJoin={handleJoin}
            joining={joiningId === group.id}
          />
        ))}
      </LearnHorizontalSlider>
    );
  };

  return (
    <div className={`learn-redesign sg-redesign ${planTierClass} ${headerSheenReady ? 'page-header-sheen-ready' : ''}`.trim()}>
      <section className="learn-shell-header">
        <div className="learn-shell-header-copy">
          <h1 className="header-sheen-copy" key={`sg-header-title-${headerSheenCycle}`}>Study Groups</h1>
          <p className="header-sheen-copy" key={`sg-header-tagline-${headerSheenCycle}`}>
            "{QUOTE}" <span className="learn-shell-header-author">- {QUOTE_AUTHOR}</span>
          </p>
        </div>
      </section>

      <section className="learn-search-panel" aria-label="Study group search and filters">
        <div className="learn-mode-switch" role="tablist" aria-label="Choose discovery mode">
          <button
            type="button"
            role="tab"
            aria-selected={discoveryMode === 'search'}
            className={`learn-mode-switch-btn ${discoveryMode === 'search' ? 'active' : ''}`}
            onClick={() => handleDiscoveryModeChange('search')}
          >
            Search
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={discoveryMode === 'filters'}
            className={`learn-mode-switch-btn ${discoveryMode === 'filters' ? 'active' : ''}`}
            onClick={() => handleDiscoveryModeChange('filters')}
          >
            Filters
          </button>
        </div>

        {discoveryMode === 'search' ? (
          <div className="learn-search-row">
            <label htmlFor="sg-search" className="learn-search-input-wrap">
              <FiSearch />
              <input
                id="sg-search"
                type="search"
                placeholder="Search groups by title, course title, or code"
                value={searchInput}
                onChange={(event) => {
                  const next = event.target.value;
                  setSearchInput(next);
                  setSearchQuery(next.trim());
                }}
              />
            </label>
          </div>
        ) : (
          <div className="learn-filter-grid">
            <LearnFilterDropdown
              label="Membership"
              value={filters.membership}
              options={[
                { value: 'all', label: 'All Groups' },
                { value: 'joined', label: 'Joined' },
                { value: 'available', label: 'Available' },
              ]}
              onChange={(nextValue) => setFilters((prev) => ({ ...prev, membership: nextValue }))}
            />
            <LearnFilterDropdown
              label="Activity"
              value={filters.activity}
              options={[
                { value: 'all', label: 'Any Activity' },
                { value: 'active', label: 'Most Active (5+ members)' },
                { value: 'fresh', label: 'Recently Added' },
              ]}
              onChange={(nextValue) => setFilters((prev) => ({ ...prev, activity: nextValue }))}
            />
          </div>
        )}
      </section>

      <div className="learn-row-divider" aria-hidden="true" />

      {error ? <p className="learn-section-empty sg-error">{error}</p> : null}

      {shouldShowInteractionResults ? (
        <>
          <section className="learn-section" aria-label={discoveryMode === 'search' ? 'Search results' : 'Filter matches'}>
            <div className="learn-section-head">
              <h2>{discoveryMode === 'search' ? 'Search Results' : 'Filter Matches'}</h2>
              <span>{visibleInteractionResults.totalCount}</span>
            </div>
            {visibleInteractionResults.totalCount === 0 ? (
              <p className="learn-section-empty">No groups matched right now.</p>
            ) : (
              <LearnHorizontalSlider
                ariaLabel={discoveryMode === 'search' ? 'Search results slider' : 'Filter results slider'}
              >
                {visibleInteractionResults.items.map((group, index) => (
                  <GroupCard
                    key={`interaction-${group.id}-${index}`}
                    group={group}
                    onJoin={handleJoin}
                    joining={joiningId === group.id}
                  />
                ))}
              </LearnHorizontalSlider>
            )}
          </section>

          <div className="learn-row-divider" aria-hidden="true" />
        </>
      ) : null}

      {showcasedSections.map((section, index) => (
        <section className="learn-section" aria-label={section.title} key={section.key}>
          <div className="learn-section-head">
            <h2>{section.title}</h2>
            <span>{section.items.length}</span>
          </div>
          {renderSliderRow(section)}
          {index < showcasedSections.length - 1 ? <div className="learn-row-divider" aria-hidden="true" /> : null}
        </section>
      ))}
    </div>
  );
}
