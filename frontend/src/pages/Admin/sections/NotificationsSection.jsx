import { useState, useEffect, useCallback } from 'react';
import { FiBell, FiSend, FiCalendar, FiChevronDown, FiChevronRight, FiRefreshCw, FiClock, FiMail, FiSmartphone, FiUsers, FiBarChart2, FiBookOpen } from 'react-icons/fi';
import api from '../../../services/api';

const TRIGGERS = [
  {
    group: 'Semester Milestones',
    items: [
      {
        id: 'sem1_start',
        label: 'First Semester Begins',
        icon: '🎓',
        template: "Hey {name}! Semester 1 is here! 📚 Your courses are ready — dive into lessons, join study groups, and stay ahead of the pack. Let's make this semester count!",
        cta: 'Start Learning',
      },
      {
        id: 'sem2_start',
        label: 'Second Semester Begins',
        icon: '🎓',
        template: "Hey {name}! Welcome to Semester 2! 💪 New courses, new opportunities. Pick up where you left off and push harder. Your study tools are waiting.",
        cta: 'Jump In',
      },
      {
        id: 'sem1_end',
        label: 'First Semester Ends',
        icon: '🏁',
        template: "Hey {name}! Semester 1 is wrapping up! ✅ Great work this semester. Review your progress, take a final test, and get ready for the break — you've earned it.",
        cta: 'Review Progress',
      },
      {
        id: 'sem2_end',
        label: 'Second Semester Ends',
        icon: '🏁',
        template: "Hey {name}! You've made it through Semester 2! 🎉 Review your learning journey, check your achievements, and celebrate your growth.",
        cta: 'See Achievements',
      },
      {
        id: 'semester_switch',
        label: 'Semester Switch',
        icon: '🔄',
        template: "Hey {name}! Your college has switched to the new semester. 🔄 Your courses and learning space are ready — jump back in and keep the momentum going!",
        cta: 'View Courses',
      },
    ],
  },
  {
    group: 'Exams & Assessments',
    items: [
      {
        id: 'midsem_start',
        label: 'Mid-Semester Quizzes Begin',
        icon: '📝',
        template: "Hey {name}! Mid-sem quizzes are starting! 🧠 Use Learnda to practice past questions, reinforce key concepts, and go in confident. Start practicing now!",
        cta: 'Practice Tests',
      },
      {
        id: 'midsem_end',
        label: 'Mid-Semester Quizzes Done',
        icon: '✅',
        template: "Hey {name}! Mid-sems are done! 😮‍💨 How did it go? Keep the momentum — your end-of-sem exams are just around the corner. Stay consistent!",
        cta: 'Continue Studying',
      },
      {
        id: 'exams_start',
        label: 'End-of-Semester Exams Begin',
        icon: '⚡',
        template: "Hey {name}! Exams are here! ⚡ Don't panic — you've got Learnda. Revise with video lessons, take practice tests, and ace your papers. You've got this!",
        cta: 'Revise Now',
      },
      {
        id: 'exams_end',
        label: 'End-of-Semester Exams Over',
        icon: '🥳',
        template: "Hey {name}! Exams are done — breathe! 🥳 Explore edutainment, join a community, or start prepping for next semester. Keep growing even on break.",
        cta: 'Explore Content',
      },
    ],
  },
  {
    group: 'Vacations',
    items: [
      {
        id: 'vacation_sem1',
        label: 'Semester 1 Break',
        icon: '🌴',
        template: "Hey {name}! Semester break is here! 🌴 Use this time wisely — explore edutainment, get ahead on next semester's topics, or just enjoy the Learnda community.",
        cta: 'Stay Engaged',
      },
      {
        id: 'vacation_sem2',
        label: 'Long Vacation',
        icon: '☀️',
        template: "Hey {name}! Long vacation time! ☀️ Keep your mind sharp — explore Learnda's edutainment library, join a study group, or pick up a skill. Growth doesn't stop on vacation.",
        cta: 'Explore Library',
      },
      {
        id: 'vacation_during',
        label: 'During Vacation',
        icon: '🌅',
        template: "Hey {name}! Vacation is in progress. 🌅 Rest well, stay connected, and use Learnda whenever you want to revise, explore edutainment, or get ahead.",
        cta: 'Explore Learnda',
      },
      {
        id: 'vacation_ending',
        label: 'Vacation Ending Soon',
        icon: '⏰',
        template: "Hey {name}! Vacation ends in {days} days. ⏰ Ease back in now — review your courses, reopen your study groups, and get ready for the next academic stretch.",
        cta: 'Prepare Now',
      },
    ],
  },
  {
    group: 'Academic Journey',
    items: [
      {
        id: 'level_begin',
        label: 'New Level / Year Begins',
        icon: '🆙',
        template: "Hey {name}! Level up! 🆙 Your college has moved you into a new academic year — welcome to your next level. Find your new courses, connect with classmates, and start strong.",
        cta: 'Find My Subjects',
      },
      {
        id: 'level_complete',
        label: 'Level / Year Complete',
        icon: '🎖️',
        template: "Hey {name}! Level complete! 🎖️ Congratulations on finishing another year. Check your achievements and get ready for what's next.",
        cta: 'View Achievements',
      },
      {
        id: 'sts',
        label: 'Student Teaching Practice (STS)',
        icon: '🏫',
        template: "Hey {name}! STS is approaching! 🏫 Learnda has everything you need — teaching resources, lesson plan templates, and community support from fellow STS students.",
        cta: 'Explore Resources',
      },
      {
        id: 'micro_teaching',
        label: 'Micro Teaching',
        icon: '🎤',
        template: "Hey {name}! Micro-teaching prep time! 🎤 Watch video lessons on effective teaching, get inspired by real educators, and sharpen your delivery skills.",
        cta: 'Watch & Learn',
      },
      {
        id: 'macro_teaching',
        label: 'Macro Teaching',
        icon: '🏆',
        template: "Hey {name}! Macro-teaching is here! 🏆 You've been preparing — now show what you've got. Use Learnda's teaching tools and community for last-minute tips.",
        cta: 'Get Tips',
      },
      {
        id: 'project_work',
        label: 'Project Work Period',
        icon: '📊',
        template: "Hey {name}! Project work season! 📊 Find research resources, collaborate with peers in study groups, and access academic content to support your project.",
        cta: 'Find Resources',
      },
    ],
  },
];

const DEFAULT_SETTINGS = {
  enabled: true,
  inactivityDays: 14,
  channels: { email: true, sms: false, push: true },
  messageTemplateId: 'gentle_comeback',
  messageTemplate:
    'Hey {name}, your courses and saved progress are still here whenever you are ready. No rush — pick up one lesson today and keep moving.',
  ctaLabel: 'Open your personal learning space',
  ctaPath: '/pls',
};

function TriggerHistory({ triggerId }) {
  const [log, setLog]       = useState([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.admin.getTriggerHistory({ triggerId, limit: 10 })
      .then((res) => { if (res?.success) { setLog(res.log || []); setTotal(res.total || 0); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [triggerId]);

  if (loading) return <div style={{ padding: '10px 0', fontSize: 12, color: 'var(--adm-text-muted)' }}>Loading history…</div>;
  if (log.length === 0) return <div style={{ padding: '10px 0', fontSize: 12, color: 'var(--adm-text-muted)', fontStyle: 'italic' }}>No sends recorded yet.</div>;

  return (
    <div style={{ marginTop: 4 }}>
      {log.map((entry, i) => (
        <div
          key={entry.id || i}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
            borderTop: i > 0 ? '1px solid var(--adm-border)' : undefined, fontSize: 12,
          }}
        >
          <FiUsers size={12} style={{ color: 'var(--adm-text-muted)', flexShrink: 0 }} />
          <span style={{ color: 'var(--adm-text)', fontWeight: 600 }}>{entry.sentTo ?? '—'} users</span>
          <span style={{ color: 'var(--adm-text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.message}
          </span>
          <span style={{ color: 'var(--adm-text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {entry.sentAt ? new Date(entry.sentAt).toLocaleString() : '—'}
          </span>
        </div>
      ))}
      {total > 10 && (
        <div style={{ fontSize: 11, color: 'var(--adm-text-muted)', paddingTop: 6 }}>Showing 10 of {total} sends</div>
      )}
    </div>
  );
}

function TriggerCard({ item }) {
  const [expanded, setExpanded]     = useState(false);
  const [message, setMessage]       = useState(item.template);
  const [sending, setSending]       = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [histKey, setHistKey]       = useState(0);
  const [daysRemaining, setDaysRemaining] = useState(7);

  const handleSend = async () => {
    setSending(true);
    setSendResult(null);
    try {
      const resolvedMessage = item.id === 'vacation_ending'
        ? message.replace(/{days}/g, String(Math.max(0, Number(daysRemaining) || 0)))
        : message;
      const res = await api.admin.sendTriggerNotification({ triggerId: item.id, label: item.label, message: resolvedMessage, cta: item.cta });
      if (res?.success) {
        setSendResult({ ok: true, msg: `Sent to ${res.sent} user${res.sent !== 1 ? 's' : ''}` });
        setHistKey((k) => k + 1);
      } else {
        setSendResult({ ok: false, msg: res?.error || 'Failed to send' });
      }
    } catch { setSendResult({ ok: false, msg: 'Server error' }); }
    setSending(false);
    setTimeout(() => setSendResult(null), 5000);
  };

  return (
    <div className="adm-notif-card" style={{ flexDirection: 'column', gap: 0, padding: 0, overflow: 'hidden' }}>
      <button
        type="button"
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="adm-notif-icon" style={{ fontSize: 18 }}>{item.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="adm-notif-title">{item.label}</div>
          {!expanded && (
            <div className="adm-notif-desc" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.template}
            </div>
          )}
        </div>
        {expanded ? <FiChevronDown size={16} style={{ color: 'var(--adm-text-muted)', flexShrink: 0 }} /> : <FiChevronRight size={16} style={{ color: 'var(--adm-text-muted)', flexShrink: 0 }} />}
      </button>

      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--adm-border)' }}>
          {/* Message editor */}
          <div style={{ marginTop: 12, marginBottom: 8, fontSize: 12, fontWeight: 600, color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Notification Message
          </div>
          <textarea
            style={{
              width: '100%', minHeight: 80, padding: '10px 12px', border: '1px solid var(--adm-border)',
              borderRadius: 'var(--adm-radius-sm)', background: 'var(--adm-bg)', color: 'var(--adm-text)',
              fontSize: 13, lineHeight: 1.5, resize: 'vertical', outline: 'none', boxSizing: 'border-box',
            }}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          {item.id === 'vacation_ending' && (
            <label style={{ display: 'grid', gap: 6, marginTop: 10, maxWidth: 180, fontSize: 12, color: 'var(--adm-text-muted)' }}>
              Days remaining
              <input
                type="number"
                min={0}
                value={daysRemaining}
                onChange={(e) => setDaysRemaining(e.target.value)}
                style={{ padding: '8px 10px', border: '1px solid var(--adm-border)', borderRadius: 'var(--adm-radius-sm)', background: 'var(--adm-bg)', color: 'var(--adm-text)' }}
              />
            </label>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--adm-text-muted)', flex: 1 }}>
              CTA: <strong style={{ color: 'var(--adm-text)' }}>{item.cta}</strong>
            </span>
            {sendResult && (
              <span style={{ fontSize: 12, color: sendResult.ok ? 'var(--adm-green)' : 'var(--adm-red)' }}>
                {sendResult.msg}
              </span>
            )}
            <button type="button" className="adm-btn adm-btn-outline" onClick={() => setMessage(item.template)}>
              Reset
            </button>
            <button type="button" className="adm-btn adm-btn-primary" onClick={handleSend} disabled={sending}>
              <FiSend size={13} />
              {sending ? 'Sending…' : 'Send Notification'}
            </button>
          </div>

          {/* Sent history for this trigger */}
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--adm-border)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FiClock size={12} /> Send History
            </div>
            <TriggerHistory key={histKey} triggerId={item.id} />
          </div>
        </div>
      )}
    </div>
  );
}

function AcademicStateSection() {
  const [scope, setScope]               = useState('single');
  const [institutions, setInstitutions] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [selectedId, setSelectedId]     = useState('');
  const [selectedUni, setSelectedUni]   = useState('');
  const [action, setAction]             = useState('semester_switch');
  const [vacationEndsOn, setVacationEndsOn] = useState('');
  const [loading, setLoading]           = useState(true);
  const [uniLoading, setUniLoading]     = useState(false);
  const [saving, setSaving]             = useState(false);
  const [result, setResult]             = useState(null);

  const loadInstitutions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.admin.getAcademicStateInstitutions();
      if (res?.success) {
        const list = res.institutions || [];
        setInstitutions(list);
        setSelectedId((cur) => cur || list[0]?.id || '');
      }
    } catch { setInstitutions([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadInstitutions(); }, [loadInstitutions]);

  const handleScopeChange = async (next) => {
    setScope(next);
    setResult(null);
    if (next === 'university' && universities.length === 0) {
      setUniLoading(true);
      try {
        const res = await api.admin.getAcademicStateUniversities();
        if (res?.success) {
          const list = res.universities || [];
          setUniversities(list);
          setSelectedUni((cur) => cur || list[0]?.name || '');
        }
      } catch { /* ignore */ }
      finally { setUniLoading(false); }
    }
  };

  const selectedInstitution = institutions.find((i) => i.id === selectedId) || null;
  const selectedUniversity  = universities.find((u) => u.name === selectedUni) || null;

  const handleApply = async () => {
    if (scope === 'single' && !selectedId) return;
    if (scope === 'university' && !selectedUni) return;
    setSaving(true);
    setResult(null);
    try {
      const payload = { scope, action, vacationEndsOn: vacationEndsOn || null };
      if (scope === 'single') payload.institutionId = selectedId;
      if (scope === 'university') payload.universityName = selectedUni;
      const res = await api.admin.applyAcademicState(payload);
      if (res?.success) {
        const u = res.updated_users;
        const s = res.skipped_users;
        const c = res.institutions_updated;
        const suffix = scope !== 'single' ? ` across ${c} college${c !== 1 ? 's' : ''}` : '';
        setResult({ ok: true, msg: `${u} student${u !== 1 ? 's' : ''} updated${s ? `, ${s} skipped` : ''}${suffix}.` });
        await loadInstitutions();
      } else {
        setResult({ ok: false, msg: res?.error || 'Failed to apply state.' });
      }
    } catch { setResult({ ok: false, msg: 'Server error.' }); }
    finally { setSaving(false); }
  };

  const scopeButtons = [
    { id: 'single',     label: 'Single College' },
    { id: 'university', label: 'By University'  },
    { id: 'all',        label: 'All Colleges'   },
  ];

  return (
    <div className="adm-card">
      <div className="adm-card-header">
        <h3 className="adm-card-title">College Academic State</h3>
        <span className="adm-badge adm-badge-gray">{institutions.length} colleges</span>
      </div>
      <div style={{ padding: '0 20px 20px', display: 'grid', gap: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--adm-text-muted)' }}>
          Apply a new academic state to one college, all colleges affiliated to a university, or every college at once. Semester switch moves students to Semester 2 on the same level; level upgrade moves students to the next level, Semester 1. Only students who turned off academic auto updates are skipped.
        </div>

        {/* Scope selector */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
            Apply To
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {scopeButtons.map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => handleScopeChange(btn.id)}
                className={`adm-btn ${scope === btn.id ? 'adm-btn-primary' : 'adm-btn-outline'}`}
                style={{ fontSize: 12, padding: '5px 14px' }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="adm-loading"><div className="adm-spinner" /> Loading colleges…</div>
        ) : (
          <>
            {/* Scope-specific picker */}
            {scope === 'single' && (
              <div>
                <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--adm-text-muted)', maxWidth: 340 }}>
                  College
                  <select
                    className="adm-select"
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                  >
                    {institutions.map((inst) => (
                      <option key={inst.id} value={inst.id}>{inst.name}</option>
                    ))}
                  </select>
                </label>
                {selectedInstitution && (
                  <div style={{ fontSize: 12, color: 'var(--adm-text-muted)', marginTop: 8 }}>
                    <strong style={{ color: 'var(--adm-text)' }}>{selectedInstitution.student_count}</strong> students linked.
                    {selectedInstitution.academic_state?.action && (
                      <> Last state: <strong style={{ color: 'var(--adm-text)' }}>{selectedInstitution.academic_state.action.replace('_', ' ')}</strong>
                      {selectedInstitution.academic_state.applied_at
                        ? ` on ${new Date(selectedInstitution.academic_state.applied_at).toLocaleDateString()}`
                        : ''}.
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {scope === 'university' && (
              <div>
                {uniLoading ? (
                  <div className="adm-loading"><div className="adm-spinner" /> Loading universities…</div>
                ) : (
                  <>
                    <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--adm-text-muted)', maxWidth: 340 }}>
                      Affiliated University
                      <select
                        className="adm-select"
                        value={selectedUni}
                        onChange={(e) => setSelectedUni(e.target.value)}
                      >
                        {universities.map((u) => (
                          <option key={u.name} value={u.name}>{u.name}</option>
                        ))}
                      </select>
                    </label>
                    {selectedUniversity && (
                      <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--adm-surface)', borderRadius: 'var(--adm-radius-sm)', border: '1px solid var(--adm-border)' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--adm-text)', marginBottom: 6 }}>
                          {selectedUniversity.colleges.length} affiliated college{selectedUniversity.colleges.length !== 1 ? 's' : ''} will be updated:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {selectedUniversity.colleges.map((c) => (
                            <span key={c.id} className="adm-badge adm-badge-blue" style={{ fontSize: 11 }}>{c.name}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {scope === 'all' && (
              <div style={{ padding: '10px 12px', background: 'rgba(251, 99, 52,0.06)', border: '1px solid rgba(251, 99, 52,0.2)', borderRadius: 'var(--adm-radius-sm)', fontSize: 13, color: 'var(--adm-text)' }}>
                ⚠️ This will apply the selected state to <strong>all {institutions.length} colleges</strong> and every student linked to them. Proceed carefully.
              </div>
            )}

            {/* Shared controls */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--adm-text-muted)' }}>
                New State
                <select className="adm-select" value={action} onChange={(e) => setAction(e.target.value)}>
                  <option value="semester_switch">Semester switch: same level, Semester 2</option>
                  <option value="level_upgrade">Level upgrade: next level, Semester 1</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--adm-text-muted)' }}>
                Vacation Ends
                <input
                  type="date"
                  className="adm-input"
                  value={vacationEndsOn}
                  onChange={(e) => setVacationEndsOn(e.target.value)}
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {result && (
                <span style={{ fontSize: 12, color: result.ok ? 'var(--adm-green)' : 'var(--adm-red)' }}>
                  {result.msg}
                </span>
              )}
              <div style={{ flex: 1 }} />
              <button
                type="button"
                className="adm-btn adm-btn-primary"
                onClick={handleApply}
                disabled={saving || (scope === 'single' && !selectedId) || (scope === 'university' && !selectedUni)}
              >
                {saving ? 'Applying…' : scope === 'all' ? `Apply to All ${institutions.length} Colleges` : 'Apply State'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ReengagementSection() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [templates, setTemplates] = useState([]);
  const [saved, setSaved]       = useState(false);
  const [saving, setSaving]     = useState(false);
  const [sending, setSending]   = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [history, setHistory]   = useState([]);
  const [histTotal, setHistTotal] = useState(0);
  const [histPage, setHistPage] = useState(1);
  const [histLoading, setHistLoading] = useState(true);
  const [targetMode, setTargetMode] = useState('inactive');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [groupType, setGroupType] = useState('role');
  const [groupRole, setGroupRole] = useState('student');
  const [groupInstitutionId, setGroupInstitutionId] = useState('');
  const [institutions, setInstitutions] = useState([]);
  const HIST_PER_PAGE = 15;

  const loadSettings = useCallback(async () => {
    try {
      const res = await api.admin.getReengagementSettings();
      if (res?.success && res.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...res.settings });
        if (Array.isArray(res.templates)) setTemplates(res.templates);
      }
    } catch { /* keep defaults */ }
  }, []);

  const applyTemplateById = (templateId) => {
    const picked = templates.find((entry) => entry.id === templateId);
    if (!picked) return;
    setSettings((current) => ({
      ...current,
      messageTemplateId: picked.id,
      messageTemplate: picked.message,
      ctaLabel: picked.ctaLabel || current.ctaLabel,
    }));
  };

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const res = await api.admin.getReengagementHistory({ limit: HIST_PER_PAGE, offset: (histPage - 1) * HIST_PER_PAGE });
      if (res?.success) { setHistory(res.log || []); setHistTotal(res.total || 0); }
    } catch { setHistory([]); }
    setHistLoading(false);
  }, [histPage]);

  useEffect(() => { loadSettings(); }, [loadSettings]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    api.admin.getAcademicStateInstitutions()
      .then((res) => {
        if (res?.success) {
          const list = res.institutions || [];
          setInstitutions(list);
          setGroupInstitutionId((cur) => cur || list[0]?.id || '');
        }
      })
      .catch(() => setInstitutions([]));
  }, []);

  useEffect(() => {
    const query = userSearch.trim();
    if (query.length < 2) {
      setUserResults([]);
      setSearchingUsers(false);
      return undefined;
    }

    let mounted = true;
    setSearchingUsers(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await api.admin.getUsers({ q: query, limit: 10, page: 1 });
        const users = Array.isArray(res?.users) ? res.users : [];
        const selectedIds = new Set(selectedUsers.map((u) => String(u.id)));
        if (mounted) {
          setUserResults(users.filter((user) => !selectedIds.has(String(user.id))));
        }
      } catch {
        if (mounted) setUserResults([]);
      } finally {
        if (mounted) setSearchingUsers(false);
      }
    }, 300);

    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [userSearch, selectedUsers]);

  const addSelectedUser = (user) => {
    setSelectedUsers((current) => {
      if (current.some((entry) => String(entry.id) === String(user.id))) return current;
      return [...current, {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone_number: user.phone_number,
        role: user.role,
      }];
    });
    setUserSearch('');
    setUserResults([]);
  };

  const removeSelectedUser = (userId) => {
    setSelectedUsers((current) => current.filter((entry) => String(entry.id) !== String(userId)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.admin.saveReengagementSettings(settings);
      if (res?.success) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleSendNow = async () => {
    if (targetMode === 'selected' && selectedUsers.length === 0) {
      setSendResult({ ok: false, msg: 'Add at least one user to send to.' });
      setTimeout(() => setSendResult(null), 6000);
      return;
    }
    if (targetMode === 'group' && groupType === 'institution' && !groupInstitutionId) {
      setSendResult({ ok: false, msg: 'Choose a college for the group.' });
      setTimeout(() => setSendResult(null), 6000);
      return;
    }

    setSending(true);
    setSendResult(null);
    try {
      const payload = {
        targetMode,
        messageTemplate: settings.messageTemplate,
        messageTemplateId: settings.messageTemplateId,
        ctaLabel: settings.ctaLabel,
        ctaPath: settings.ctaPath,
        channels: settings.channels,
        inactivityDays: settings.inactivityDays,
        skipCooldown: targetMode !== 'inactive',
      };

      if (targetMode === 'selected') {
        payload.userIds = selectedUsers.map((user) => user.id);
      } else if (targetMode === 'group') {
        payload.group = { type: groupType };
        if (groupType === 'role') payload.group.role = groupRole;
        if (groupType === 'institution') payload.group.institutionId = groupInstitutionId;
      }

      const res = await api.admin.sendReengagement(payload);
      if (res?.success) {
        const parts = [`Sent to ${res.sent} user${res.sent !== 1 ? 's' : ''}`];
        if (res.matched != null && res.matched !== res.sent) {
          parts.push(`${res.matched} matched`);
        }
        if (res.skipped > 0) {
          parts.push(`${res.skipped} skipped`);
        }
        setSendResult({ ok: true, msg: parts.join(' · ') });
        if (targetMode === 'selected') setSelectedUsers([]);
        loadHistory();
      } else {
        setSendResult({ ok: false, msg: res?.error || 'Failed to send' });
      }
    } catch (err) {
      setSendResult({ ok: false, msg: err?.message || 'Server error' });
    }
    setSending(false);
    setTimeout(() => setSendResult(null), 8000);
  };

  const totalHistPages = Math.ceil(histTotal / HIST_PER_PAGE);

  return (
    <>
      {/* Settings card */}
      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiRefreshCw size={15} /> Re-engagement Automation
          </h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
            <div
              style={{
                width: 36, height: 20, borderRadius: 10, background: settings.enabled ? 'var(--adm-primary)' : 'var(--adm-border)',
                position: 'relative', cursor: 'pointer',
              }}
              onClick={() => setSettings((s) => ({ ...s, enabled: !s.enabled }))}
            >
              <div style={{
                position: 'absolute', top: 2, left: settings.enabled ? 18 : 2,
                width: 16, height: 16, borderRadius: '50%', background: '#fff',
              }} />
            </div>
            <span style={{ fontSize: 13, color: settings.enabled ? 'var(--adm-primary)' : 'var(--adm-text-muted)' }}>
              {settings.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>

        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Inactivity threshold */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              Inactivity Threshold
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="number"
                min={1}
                max={365}
                style={{ width: 72, padding: '8px 10px', border: '1px solid var(--adm-border)', borderRadius: 'var(--adm-radius-sm)', background: 'var(--adm-bg)', color: 'var(--adm-text)', fontSize: 13, outline: 'none' }}
                value={settings.inactivityDays}
                onChange={(e) => setSettings((s) => ({ ...s, inactivityDays: Number(e.target.value) }))}
              />
              <span style={{ fontSize: 13, color: 'var(--adm-text-muted)' }}>days of inactivity before a user is messaged</span>
            </div>
          </div>

          {/* Channels */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              Channels
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                { key: 'email', label: 'Email', icon: FiMail },
                { key: 'sms', label: 'SMS', icon: FiSmartphone },
                { key: 'push', label: 'Push Notification', icon: FiBell },
              ].map(({ key, label, icon: Icon }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={settings.channels?.[key] || false}
                    onChange={(e) => setSettings((s) => ({ ...s, channels: { ...s.channels, [key]: e.target.checked } }))}
                    style={{ accentColor: 'var(--adm-primary)', width: 14, height: 14 }}
                  />
                  <Icon size={13} style={{ color: 'var(--adm-text-muted)' }} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Message template */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              Message Template
            </div>
            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--adm-text-muted)', marginBottom: 10 }}>
              Choose a preset (10 tones)
              <select
                className="adm-select"
                value={settings.messageTemplateId || ''}
                onChange={(e) => applyTemplateById(e.target.value)}
              >
                {templates.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label} ({entry.tone})
                  </option>
                ))}
              </select>
            </label>
            <div style={{ fontSize: 12, color: 'var(--adm-text-muted)', marginBottom: 8 }}>
              In-app title shown to users: <strong style={{ color: 'var(--adm-text)' }}>Learnda missing you</strong> (not “re-engagement”).
            </div>
            <textarea
              style={{
                width: '100%', minHeight: 96, padding: '10px 12px', border: '1px solid var(--adm-border)',
                borderRadius: 'var(--adm-radius-sm)', background: 'var(--adm-bg)', color: 'var(--adm-text)',
                fontSize: 13, lineHeight: 1.6, resize: 'vertical', outline: 'none', boxSizing: 'border-box',
              }}
              value={settings.messageTemplate}
              onChange={(e) => setSettings((s) => ({ ...s, messageTemplate: e.target.value }))}
              placeholder="Use {name} to personalize…"
            />
            <div style={{ fontSize: 11, color: 'var(--adm-text-muted)', marginTop: 4 }}>
              Use <code style={{ background: 'var(--adm-surface)', padding: '1px 4px', borderRadius: 3 }}>{'{name}'}</code> for the first name. You can edit any preset before sending.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--adm-text-muted)' }}>
              CTA button label (email & SMS)
              <input
                className="adm-input"
                value={settings.ctaLabel || ''}
                onChange={(e) => setSettings((s) => ({ ...s, ctaLabel: e.target.value }))}
              />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--adm-text-muted)' }}>
              CTA link (in-app path)
              <select
                className="adm-select"
                value={settings.ctaPath || '/pls'}
                onChange={(e) => setSettings((s) => ({ ...s, ctaPath: e.target.value }))}
              >
                <option value="/pls">Personal Learning Space (/pls)</option>
                <option value="/learn">Learn (/learn)</option>
                <option value="/practice">Practice (/practice)</option>
                <option value="/">Home (/)</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {saved && <span style={{ fontSize: 12, color: 'var(--adm-green)' }}>Settings saved</span>}
            <div style={{ flex: 1 }} />
            <button type="button" className="adm-btn adm-btn-outline" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* Manual send */}
      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiSend size={15} /> Manual Send
          </h3>
        </div>
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--adm-text-muted)' }}>
            Uses the message template and channels above. Choose who should receive this send.
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              Recipients
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {[
                { id: 'inactive', label: 'Inactive users' },
                { id: 'selected', label: 'Selected users' },
                { id: 'group', label: 'User group' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`adm-btn ${targetMode === opt.id ? 'adm-btn-primary' : 'adm-btn-outline'}`}
                  style={{ fontSize: 12, padding: '5px 14px' }}
                  onClick={() => setTargetMode(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {targetMode === 'inactive' && (
              <div style={{ fontSize: 13, color: 'var(--adm-text-muted)' }}>
                Sends to users inactive for <strong style={{ color: 'var(--adm-text)' }}>{settings.inactivityDays}</strong> days who have not received a re-engagement message in that window.
              </div>
            )}

            {targetMode === 'selected' && (
              <div style={{ display: 'grid', gap: 10 }}>
                <input
                  className="adm-search"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search by name, email, or phone (min. 2 characters)"
                />
                {searchingUsers && <span style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>Searching…</span>}
                {!!userResults.length && (
                  <div className="adm-user-search-results">
                    {userResults.map((user) => (
                      <div key={user.id} className="adm-user-search-result">
                        <div>
                          <div className="adm-user-result-name">{user.full_name || user.email || 'Unnamed user'}</div>
                          <div className="adm-card-subtitle">{user.email || user.phone_number || 'No contact'}</div>
                        </div>
                        <span className="adm-badge adm-badge-gray">{user.role || 'student'}</span>
                        <button type="button" className="adm-btn adm-btn-outline" onClick={() => addSelectedUser(user)}>
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {selectedUsers.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {selectedUsers.map((user) => (
                      <span
                        key={user.id}
                        className="adm-badge adm-badge-blue"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', fontSize: 12 }}
                      >
                        {user.full_name || user.email}
                        <button
                          type="button"
                          onClick={() => removeSelectedUser(user.id)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'inherit', fontWeight: 700 }}
                          aria-label={`Remove ${user.full_name || user.email}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>
                  {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected (max 200 per send).
                </div>
              </div>
            )}

            {targetMode === 'group' && (
              <div style={{ display: 'grid', gap: 10, maxWidth: 360 }}>
                <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--adm-text-muted)' }}>
                  Group type
                  <select className="adm-select" value={groupType} onChange={(e) => setGroupType(e.target.value)}>
                    <option value="role">By role</option>
                    <option value="institution">By college</option>
                    <option value="inactive">Inactive users (same threshold)</option>
                  </select>
                </label>
                {groupType === 'role' && (
                  <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--adm-text-muted)' }}>
                    Role
                    <select className="adm-select" value={groupRole} onChange={(e) => setGroupRole(e.target.value)}>
                      <option value="student">Students</option>
                      <option value="lecturer">Lecturers</option>
                      <option value="admin">Admins</option>
                    </select>
                  </label>
                )}
                {groupType === 'institution' && (
                  <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--adm-text-muted)' }}>
                    College
                    <select className="adm-select" value={groupInstitutionId} onChange={(e) => setGroupInstitutionId(e.target.value)}>
                      {institutions.map((inst) => (
                        <option key={inst.id} value={inst.id}>{inst.name}</option>
                      ))}
                    </select>
                  </label>
                )}
                {groupType === 'inactive' && (
                  <div style={{ fontSize: 13, color: 'var(--adm-text-muted)' }}>
                    All users inactive for <strong>{settings.inactivityDays}</strong> days (no recent-send cooldown for groups).
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {sendResult && (
              <span style={{ fontSize: 12, color: sendResult.ok ? 'var(--adm-green)' : 'var(--adm-red)' }}>{sendResult.msg}</span>
            )}
            <div style={{ flex: 1 }} />
            <button type="button" className="adm-btn adm-btn-primary" onClick={handleSendNow} disabled={sending}>
              <FiSend size={13} />
              {sending ? 'Sending…' : 'Send to recipients'}
            </button>
          </div>
        </div>
      </div>

      {/* Message history */}
      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiClock size={15} /> Re-engagement History
          </h3>
          <span style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>{histTotal} messages sent</span>
        </div>

        {histLoading ? (
          <div className="adm-loading"><div className="adm-spinner" /> Loading history…</div>
        ) : (
          <>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Channels</th>
                    <th>Sent At</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry, i) => (
                    <tr key={entry.id || i}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{entry.userName || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--adm-text-muted)' }}>{entry.userEmail || ''}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {(entry.channels || []).map((ch) => (
                            <span key={ch} className="adm-badge adm-badge-blue" style={{ fontSize: 10 }}>{ch}</span>
                          ))}
                          {!entry.channels?.length && <span style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>—</span>}
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--adm-text-muted)', whiteSpace: 'nowrap' }}>
                        {entry.sentAt ? new Date(entry.sentAt).toLocaleString() : '—'}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>
                        {entry.reason || `Inactive ${entry.inactiveDays || '?'}d`}
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr><td colSpan={4}>
                      <div className="adm-empty">
                        <div className="adm-empty-icon"><FiRefreshCw /></div>
                        <p>No re-engagement messages sent yet.</p>
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {totalHistPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--adm-border)' }}>
                <button type="button" className="adm-btn adm-btn-outline" disabled={histPage === 1} onClick={() => setHistPage((p) => p - 1)}>Previous</button>
                <span style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>{histPage} / {totalHistPages}</span>
                <button type="button" className="adm-btn adm-btn-outline" disabled={histPage === totalHistPages} onClick={() => setHistPage((p) => p + 1)}>Next</button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

const TIP_CTA_OPTIONS = [
  { value: '/pls', label: 'Personal Learning Space (/pls)' },
  { value: '/learn', label: 'Learn (/learn)' },
  { value: '/practice', label: 'Practice (/practice)' },
  { value: '/progress', label: 'Progress (/progress)' },
  { value: '/edutainment', label: 'Edutainment (/edutainment)' },
  { value: '/invite-friends', label: 'Invite friends (/invite-friends)' },
  { value: '/', label: 'Home (/)' },
];

function EngagementTipsSection() {
  const [category, setCategory] = useState('study');
  const [studyTips, setStudyTips] = useState([]);
  const [learndaTips, setLearndaTips] = useState([]);
  const [tipId, setTipId] = useState('');
  const [message, setMessage] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaPath, setCtaPath] = useState('/pls');
  const [channels, setChannels] = useState({ push: true, email: true, sms: false });
  const [inactivityDays, setInactivityDays] = useState(14);
  const [targetMode, setTargetMode] = useState('selected');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [groupType, setGroupType] = useState('role');
  const [groupRole, setGroupRole] = useState('student');
  const [groupInstitutionId, setGroupInstitutionId] = useState('');
  const [institutions, setInstitutions] = useState([]);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [histTotal, setHistTotal] = useState(0);
  const [histPage, setHistPage] = useState(1);
  const [histLoading, setHistLoading] = useState(true);
  const [histCategory, setHistCategory] = useState('');
  const HIST_PER_PAGE = 15;

  const catalog = category === 'learnda' ? learndaTips : studyTips;

  const applyTip = useCallback((tips, id, cat) => {
    const list = cat === 'learnda' ? learndaTips : studyTips;
    const picked = list.find((t) => t.id === id) || tips.find((t) => t.id === id) || list[0];
    if (!picked) return;
    setTipId(picked.id);
    setMessage(picked.message || '');
    setCtaLabel(picked.ctaLabel || '');
    setCtaPath(picked.ctaPath || '/pls');
  }, [learndaTips, studyTips]);

  useEffect(() => {
    api.admin.getEngagementTipsCatalog()
      .then((res) => {
        if (!res?.success) return;
        const study = res.studyTips || [];
        const learnda = res.learndaTips || [];
        setStudyTips(study);
        setLearndaTips(learnda);
        const first = study[0];
        if (first) {
          setTipId(first.id);
          setMessage(first.message || '');
          setCtaLabel(first.ctaLabel || '');
          setCtaPath(first.ctaPath || '/pls');
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const list = category === 'learnda' ? learndaTips : studyTips;
    if (!list.length) return;
    const exists = list.some((t) => t.id === tipId);
    applyTip(list, exists ? tipId : list[0].id, category);
  }, [category, studyTips, learndaTips]);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const params = { limit: HIST_PER_PAGE, offset: (histPage - 1) * HIST_PER_PAGE };
      if (histCategory) params.category = histCategory;
      const res = await api.admin.getEngagementTipsHistory(params);
      if (res?.success) {
        setHistory(res.log || []);
        setHistTotal(res.total || 0);
      }
    } catch {
      setHistory([]);
    }
    setHistLoading(false);
  }, [histPage, histCategory]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    api.admin.getAcademicStateInstitutions()
      .then((res) => {
        if (res?.success) {
          const list = res.institutions || [];
          setInstitutions(list);
          setGroupInstitutionId((cur) => cur || list[0]?.id || '');
        }
      })
      .catch(() => setInstitutions([]));
  }, []);

  useEffect(() => {
    const query = userSearch.trim();
    if (query.length < 2) {
      setUserResults([]);
      setSearchingUsers(false);
      return undefined;
    }

    let mounted = true;
    setSearchingUsers(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await api.admin.getUsers({ q: query, limit: 10, page: 1 });
        const users = Array.isArray(res?.users) ? res.users : [];
        const selectedIds = new Set(selectedUsers.map((u) => String(u.id)));
        if (mounted) {
          setUserResults(users.filter((user) => !selectedIds.has(String(user.id))));
        }
      } catch {
        if (mounted) setUserResults([]);
      } finally {
        if (mounted) setSearchingUsers(false);
      }
    }, 300);

    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [userSearch, selectedUsers]);

  const addSelectedUser = (user) => {
    setSelectedUsers((current) => {
      if (current.some((entry) => String(entry.id) === String(user.id))) return current;
      return [...current, {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone_number: user.phone_number,
        role: user.role,
      }];
    });
    setUserSearch('');
    setUserResults([]);
  };

  const removeSelectedUser = (userId) => {
    setSelectedUsers((current) => current.filter((entry) => String(entry.id) !== String(userId)));
  };

  const handleSend = async () => {
    if (targetMode === 'selected' && selectedUsers.length === 0) {
      setSendResult({ ok: false, msg: 'Add at least one user to send to.' });
      setTimeout(() => setSendResult(null), 6000);
      return;
    }
    if (targetMode === 'group' && groupType === 'institution' && !groupInstitutionId) {
      setSendResult({ ok: false, msg: 'Choose a college for the group.' });
      setTimeout(() => setSendResult(null), 6000);
      return;
    }

    setSending(true);
    setSendResult(null);
    try {
      const payload = {
        category,
        tipId,
        message,
        ctaLabel,
        ctaPath,
        channels,
        targetMode,
        inactivityDays,
      };

      if (targetMode === 'selected') {
        payload.userIds = selectedUsers.map((user) => user.id);
      } else if (targetMode === 'group') {
        payload.group = { type: groupType };
        if (groupType === 'role') payload.group.role = groupRole;
        if (groupType === 'institution') payload.group.institutionId = groupInstitutionId;
      }

      const res = await api.admin.sendEngagementTips(payload);
      if (res?.success) {
        const parts = [`Sent to ${res.sent} user${res.sent !== 1 ? 's' : ''}`];
        if (res.matched != null && res.matched !== res.sent) {
          parts.push(`${res.matched} matched`);
        }
        setSendResult({ ok: true, msg: parts.join(' · ') });
        if (targetMode === 'selected') setSelectedUsers([]);
        loadHistory();
      } else {
        setSendResult({ ok: false, msg: res?.error || 'Failed to send' });
      }
    } catch (err) {
      setSendResult({ ok: false, msg: err?.message || 'Server error' });
    }
    setSending(false);
    setTimeout(() => setSendResult(null), 8000);
  };

  const totalHistPages = Math.ceil(histTotal / HIST_PER_PAGE);
  const inAppTitle = category === 'learnda' ? 'Learnda tip' : 'Study tip';

  return (
    <>
      <div className="adm-card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div className="adm-notif-icon"><FiBookOpen /></div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--adm-text)' }}>Study tips & Learnda tricks</div>
            <div style={{ fontSize: 13, color: 'var(--adm-text-muted)', marginTop: 3 }}>
              Send helpful study habits or platform how-tos via push, email, and SMS. Users see friendly titles like <strong>Study tip</strong> — not admin jargon.
            </div>
          </div>
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiSend size={15} /> Send a tip
          </h3>
        </div>
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { id: 'study', label: 'Study tips' },
              { id: 'learnda', label: 'Learnda tips & tricks' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`adm-btn ${category === opt.id ? 'adm-btn-primary' : 'adm-btn-outline'}`}
                style={{ fontSize: 12, padding: '5px 14px' }}
                onClick={() => setCategory(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              Choose a tip ({catalog.length} presets)
            </div>
            <select
              className="adm-select"
              value={tipId}
              onChange={(e) => applyTip(catalog, e.target.value, category)}
            >
              {catalog.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label} ({entry.tone})
                </option>
              ))}
            </select>
            <div style={{ fontSize: 12, color: 'var(--adm-text-muted)', marginTop: 8 }}>
              In-app title: <strong style={{ color: 'var(--adm-text)' }}>{inAppTitle}</strong>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              Message
            </div>
            <textarea
              style={{
                width: '100%', minHeight: 96, padding: '10px 12px', border: '1px solid var(--adm-border)',
                borderRadius: 'var(--adm-radius-sm)', background: 'var(--adm-bg)', color: 'var(--adm-text)',
                fontSize: 13, lineHeight: 1.6, resize: 'vertical', outline: 'none', boxSizing: 'border-box',
              }}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Use {name} for the first name…"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--adm-text-muted)' }}>
              CTA button label
              <input className="adm-input" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--adm-text-muted)' }}>
              CTA link (in-app path)
              <select className="adm-select" value={ctaPath} onChange={(e) => setCtaPath(e.target.value)}>
                {TIP_CTA_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
                {!TIP_CTA_OPTIONS.some((o) => o.value === ctaPath) && ctaPath && (
                  <option value={ctaPath}>{ctaPath}</option>
                )}
              </select>
            </label>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              Channels
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                { key: 'email', label: 'Email', icon: FiMail },
                { key: 'sms', label: 'SMS', icon: FiSmartphone },
                { key: 'push', label: 'Push', icon: FiBell },
              ].map(({ key, label, icon: Icon }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={channels[key] || false}
                    onChange={(e) => setChannels((s) => ({ ...s, [key]: e.target.checked }))}
                    style={{ accentColor: 'var(--adm-primary)', width: 14, height: 14 }}
                  />
                  <Icon size={13} style={{ color: 'var(--adm-text-muted)' }} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--adm-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              Recipients
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {[
                { id: 'selected', label: 'Selected users' },
                { id: 'group', label: 'User group' },
                { id: 'inactive', label: 'Inactive users' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`adm-btn ${targetMode === opt.id ? 'adm-btn-primary' : 'adm-btn-outline'}`}
                  style={{ fontSize: 12, padding: '5px 14px' }}
                  onClick={() => setTargetMode(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {targetMode === 'inactive' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="number"
                  min={1}
                  max={365}
                  style={{ width: 72, padding: '8px 10px', border: '1px solid var(--adm-border)', borderRadius: 'var(--adm-radius-sm)', background: 'var(--adm-bg)', color: 'var(--adm-text)', fontSize: 13 }}
                  value={inactivityDays}
                  onChange={(e) => setInactivityDays(Number(e.target.value))}
                />
                <span style={{ fontSize: 13, color: 'var(--adm-text-muted)' }}>days without activity</span>
              </div>
            )}

            {targetMode === 'selected' && (
              <div style={{ display: 'grid', gap: 10 }}>
                <input
                  className="adm-search"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search by name, email, or phone (min. 2 characters)"
                />
                {searchingUsers && <span style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>Searching…</span>}
                {!!userResults.length && (
                  <div className="adm-user-search-results">
                    {userResults.map((user) => (
                      <div key={user.id} className="adm-user-search-result">
                        <div>
                          <div className="adm-user-result-name">{user.full_name || user.email || 'Unnamed user'}</div>
                          <div className="adm-card-subtitle">{user.email || user.phone_number || 'No contact'}</div>
                        </div>
                        <span className="adm-badge adm-badge-gray">{user.role || 'student'}</span>
                        <button type="button" className="adm-btn adm-btn-outline" onClick={() => addSelectedUser(user)}>
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {selectedUsers.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {selectedUsers.map((user) => (
                      <span
                        key={user.id}
                        className="adm-badge adm-badge-blue"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', fontSize: 12 }}
                      >
                        {user.full_name || user.email}
                        <button
                          type="button"
                          onClick={() => removeSelectedUser(user.id)}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'inherit', fontWeight: 700 }}
                          aria-label={`Remove ${user.full_name || user.email}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>
                  {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected (max 200 per send).
                </div>
              </div>
            )}

            {targetMode === 'group' && (
              <div style={{ display: 'grid', gap: 10, maxWidth: 360 }}>
                <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--adm-text-muted)' }}>
                  Group type
                  <select className="adm-select" value={groupType} onChange={(e) => setGroupType(e.target.value)}>
                    <option value="role">By role</option>
                    <option value="institution">By college</option>
                    <option value="inactive">Inactive users</option>
                  </select>
                </label>
                {groupType === 'role' && (
                  <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--adm-text-muted)' }}>
                    Role
                    <select className="adm-select" value={groupRole} onChange={(e) => setGroupRole(e.target.value)}>
                      <option value="student">Students</option>
                      <option value="lecturer">Lecturers</option>
                      <option value="admin">Admins</option>
                    </select>
                  </label>
                )}
                {groupType === 'institution' && (
                  <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--adm-text-muted)' }}>
                    College
                    <select className="adm-select" value={groupInstitutionId} onChange={(e) => setGroupInstitutionId(e.target.value)}>
                      {institutions.map((inst) => (
                        <option key={inst.id} value={inst.id}>{inst.name}</option>
                      ))}
                    </select>
                  </label>
                )}
                {groupType === 'inactive' && (
                  <div style={{ fontSize: 13, color: 'var(--adm-text-muted)' }}>
                    Users inactive for <strong>{inactivityDays}</strong> days.
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {sendResult && (
              <span style={{ fontSize: 12, color: sendResult.ok ? 'var(--adm-green)' : 'var(--adm-red)' }}>{sendResult.msg}</span>
            )}
            <div style={{ flex: 1 }} />
            <button type="button" className="adm-btn adm-btn-primary" onClick={handleSend} disabled={sending}>
              <FiSend size={13} />
              {sending ? 'Sending…' : 'Send tip'}
            </button>
          </div>
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiClock size={15} /> Tips send history
          </h3>
          <select
            className="adm-select"
            style={{ maxWidth: 180, fontSize: 12 }}
            value={histCategory}
            onChange={(e) => { setHistCategory(e.target.value); setHistPage(1); }}
          >
            <option value="">All tips</option>
            <option value="study">Study tips only</option>
            <option value="learnda">Learnda tips only</option>
          </select>
        </div>

        {histLoading ? (
          <div className="adm-loading"><div className="adm-spinner" /> Loading history…</div>
        ) : (
          <>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Tip</th>
                    <th>Channels</th>
                    <th>Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry, i) => (
                    <tr key={entry.id || i}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{entry.userName || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--adm-text-muted)' }}>{entry.userEmail || ''}</div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>
                        {entry.reason || entry.tipLabel || entry.tipId || '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {(entry.channels || []).map((ch) => (
                            <span key={ch} className="adm-badge adm-badge-blue" style={{ fontSize: 10 }}>{ch}</span>
                          ))}
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--adm-text-muted)', whiteSpace: 'nowrap' }}>
                        {entry.sentAt ? new Date(entry.sentAt).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr><td colSpan={4}>
                      <div className="adm-empty">
                        <div className="adm-empty-icon"><FiBookOpen /></div>
                        <p>No tips sent yet.</p>
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {totalHistPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--adm-border)' }}>
                <button type="button" className="adm-btn adm-btn-outline" disabled={histPage === 1} onClick={() => setHistPage((p) => p - 1)}>Previous</button>
                <span style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>{histPage} / {totalHistPages}</span>
                <button type="button" className="adm-btn adm-btn-outline" disabled={histPage === totalHistPages} onClick={() => setHistPage((p) => p + 1)}>Next</button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function NotificationAnalyticsSection() {
  const [rangeDays, setRangeDays] = useState(30);
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const PAGE_SIZE = 25;

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.admin.getNotificationAnalytics({
        range_days: rangeDays,
        type: typeFilter || undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });
      if (!res?.success) {
        throw new Error(res?.error || 'Failed to load notification analytics');
      }
      setData(res);
    } catch (err) {
      setData(null);
      setError(err?.message || 'Failed to load notification analytics');
    } finally {
      setLoading(false);
    }
  }, [page, rangeDays, typeFilter]);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);
  useEffect(() => { setPage(1); }, [rangeDays, typeFilter]);

  const summary = data?.summary || {};
  const byType = data?.by_type || [];
  const daily = data?.daily_series || [];
  const rows = data?.recent?.rows || [];
  const total = Number(data?.recent?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiBarChart2 size={15} /> Notification Analytics
          </h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="adm-select" value={String(rangeDays)} onChange={(e) => setRangeDays(Number(e.target.value) || 30)}>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="180">Last 180 days</option>
            </select>
            <select className="adm-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All types</option>
              {byType.map((entry) => (
                <option key={entry.type} value={entry.type}>{entry.type}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ padding: '0 20px 20px', display: 'grid', gap: 16 }}>
          {loading && <div className="adm-loading"><div className="adm-spinner" /> Loading analytics…</div>}
          {!loading && error && <div style={{ color: 'var(--adm-red)', fontSize: 13 }}>{error}</div>}
          {!loading && !error && (
            <>
              <div className="adm-stats">
                <div className="adm-stat accent-teal">
                  <div className="adm-stat-top"><div className="adm-stat-label">Total Sent</div><div className="adm-stat-icon"><FiSend size={14} /></div></div>
                  <div className="adm-stat-value">{summary.total_sent || 0}</div>
                </div>
                <div className="adm-stat accent-green">
                  <div className="adm-stat-top"><div className="adm-stat-label">Read Rate</div><div className="adm-stat-icon"><FiMail size={14} /></div></div>
                  <div className="adm-stat-value">{summary.read_rate || 0}%</div>
                </div>
                <div className="adm-stat accent-blue">
                  <div className="adm-stat-top"><div className="adm-stat-label">Unique Recipients</div><div className="adm-stat-icon"><FiUsers size={14} /></div></div>
                  <div className="adm-stat-value">{summary.unique_users || 0}</div>
                </div>
                <div className="adm-stat accent-amber">
                  <div className="adm-stat-top"><div className="adm-stat-label">Unread</div><div className="adm-stat-icon"><FiBell size={14} /></div></div>
                  <div className="adm-stat-value">{summary.total_unread || 0}</div>
                </div>
              </div>

              <div className="adm-grid-2">
                <div style={{ border: '1px solid var(--adm-border)', borderRadius: 'var(--adm-radius-sm)', padding: '12px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--adm-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>By Type</div>
                  {byType.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>No notifications in this range.</div>
                  ) : byType.map((entry) => (
                    <div key={entry.type} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid var(--adm-border)' }}>
                      <span style={{ fontSize: 13, color: 'var(--adm-text)' }}>{entry.type}</span>
                      <span style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>{entry.count}</span>
                    </div>
                  ))}
                </div>

                <div style={{ border: '1px solid var(--adm-border)', borderRadius: 'var(--adm-radius-sm)', padding: '12px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--adm-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Campaign Reach</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, color: 'var(--adm-text)' }}>Calendar Trigger Recipients</span>
                      <strong style={{ fontSize: 13 }}>{data?.campaigns?.trigger_recipients || 0}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, color: 'var(--adm-text)' }}>Re-engagement Recipients</span>
                      <strong style={{ fontSize: 13 }}>{data?.campaigns?.reengagement_recipients || 0}</strong>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--adm-text-muted)' }}>
                      Date coverage and filters match the selected range.
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ border: '1px solid var(--adm-border)', borderRadius: 'var(--adm-radius-sm)', padding: '12px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--adm-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Daily Sends</div>
                {daily.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>No daily activity yet.</div>
                ) : (
                  <div style={{ display: 'grid', gap: 6 }}>
                    {daily.slice(-12).map((point) => (
                      <div key={point.date} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: 'var(--adm-text)' }}>{new Date(point.date).toLocaleDateString()}</span>
                        <span style={{ color: 'var(--adm-text-muted)' }}>{point.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-card-header">
          <h3 className="adm-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiClock size={15} /> Recent Notifications
          </h3>
          <span style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>{total} in range</span>
        </div>
        {loading ? (
          <div className="adm-loading"><div className="adm-spinner" /> Loading notifications…</div>
        ) : (
          <>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Recipient</th>
                    <th>Type</th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Sent At</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{entry.user?.name || 'Unknown user'}</div>
                        <div style={{ fontSize: 11, color: 'var(--adm-text-muted)' }}>{entry.user?.email || ''}</div>
                      </td>
                      <td><span className="adm-badge adm-badge-blue" style={{ fontSize: 10 }}>{entry.type}</span></td>
                      <td style={{ maxWidth: 300 }}>
                        <div style={{ fontSize: 12, color: 'var(--adm-text)', fontWeight: 600 }}>{entry.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--adm-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.body}</div>
                      </td>
                      <td style={{ fontSize: 12, color: entry.is_read ? 'var(--adm-green)' : 'var(--adm-amber)' }}>
                        {entry.is_read ? 'Read' : 'Unread'}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--adm-text-muted)', whiteSpace: 'nowrap' }}>
                        {entry.sent_at ? new Date(entry.sent_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={5}>
                      <div className="adm-empty">
                        <div className="adm-empty-icon"><FiBell /></div>
                        <p>No notifications in this filter.</p>
                      </div>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--adm-border)' }}>
                <button type="button" className="adm-btn adm-btn-outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <span style={{ fontSize: 12, color: 'var(--adm-text-muted)' }}>{page} / {totalPages}</span>
                <button type="button" className="adm-btn adm-btn-outline" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default function NotificationsSection() {
  const [tab, setTab] = useState('calendar');

  return (
    <>
      {/* Tab bar */}
      <div className="adm-modal-tabs" style={{ marginBottom: 20 }}>
        <button
          type="button"
          className={`adm-modal-tab${tab === 'calendar' ? ' is-active' : ''}`}
          onClick={() => setTab('calendar')}
        >
          <FiCalendar size={13} /> Academic Calendar
        </button>
        <button
          type="button"
          className={`adm-modal-tab${tab === 'reengagement' ? ' is-active' : ''}`}
          onClick={() => setTab('reengagement')}
        >
          <FiRefreshCw size={13} /> Re-engagement
        </button>
        <button
          type="button"
          className={`adm-modal-tab${tab === 'tips' ? ' is-active' : ''}`}
          onClick={() => setTab('tips')}
        >
          <FiBookOpen size={13} /> Tips & tricks
        </button>
        <button
          type="button"
          className={`adm-modal-tab${tab === 'analytics' ? ' is-active' : ''}`}
          onClick={() => setTab('analytics')}
        >
          <FiBarChart2 size={13} /> Analytics
        </button>
      </div>

      {tab === 'calendar' && (
        <>
          <div className="adm-card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div className="adm-notif-icon"><FiCalendar /></div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--adm-text)' }}>Academic Calendar Triggers</div>
                <div style={{ fontSize: 13, color: 'var(--adm-text-muted)', marginTop: 3 }}>
                  Pre-filled notifications tied to academic milestones. Expand any trigger to edit the message and send it to all users.
                </div>
              </div>
            </div>
          </div>

          <AcademicStateSection />

          {TRIGGERS.map((group) => (
            <div key={group.group} className="adm-card">
              <div className="adm-card-header">
                <h3 className="adm-card-title">{group.group}</h3>
                <span className="adm-badge adm-badge-gray">{group.items.length} triggers</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {group.items.map((item, i) => (
                  <div key={item.id} style={{ borderTop: i > 0 ? '1px solid var(--adm-border)' : undefined }}>
                    <TriggerCard item={item} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {tab === 'reengagement' && <ReengagementSection />}
      {tab === 'tips' && <EngagementTipsSection />}
      {tab === 'analytics' && <NotificationAnalyticsSection />}
    </>
  );
}
