import { useEffect, useMemo, useState } from 'react';
import { FiBookOpen, FiEdit3, FiPlus, FiSave, FiTrash2, FiUsers } from 'react-icons/fi';
import api from '../../../services/api';

const BLOG_TEMPLATES = [
  {
    id: 'platform-overview',
    name: 'Platform feature spotlight',
    category: 'Platform',
    tags: 'platform, features, sharether',
    title: 'How Sharether helps students learn, practice, and grow in one place',
    description: 'A feature-focused article explaining how the platform connects learning tools, practice, resources, and student support.',
    body: [
      '<p>Sharether is built around one simple idea: students should not have to jump across scattered tools just to learn, practice, organize resources, and stay connected.</p>',
      '<h2>What students can do</h2>',
      '<p>Use this section to explain the feature, the problem it solves, and the exact student workflow it improves.</p>',
      '<h2>Why it matters</h2>',
      '<p>Connect the feature to outcomes: faster revision, better organization, easier collaboration, or more confident learning.</p>',
      '<h2>How to get started</h2>',
      '<p>Close with simple steps and a clear action for readers.</p>',
    ].join('\n'),
  },
  {
    id: 'practice',
    name: 'Practice and exams',
    category: 'Practice',
    tags: 'practice, exams, quizzes, past questions',
    title: 'Practice smarter with quizzes, past questions, and focused revision',
    description: 'A practical blog template for explaining Sharether practice tools and exam preparation workflows.',
    body: [
      '<p>Exam preparation works better when practice is structured, quick to access, and connected to what students are already studying.</p>',
      '<h2>The challenge</h2>',
      '<p>Explain the pain point students face before this feature.</p>',
      '<h2>The Sharether workflow</h2>',
      '<p>Describe how students move from a topic to questions, feedback, and revision.</p>',
      '<h2>Tips for students</h2>',
      '<p>Add three to five practical study habits that fit the feature.</p>',
    ].join('\n'),
  },
  {
    id: 'pls',
    name: 'Personal Learning Space',
    category: 'Learning Space',
    tags: 'pls, resources, folders, study groups',
    title: 'Organize your learning with Personal Learning Space',
    description: 'A template for writing about files, folders, resources, and study organization in Sharether.',
    body: [
      '<p>Your Personal Learning Space gives every student a cleaner way to keep learning materials, saved content, and study activity organized.</p>',
      '<h2>What belongs in your space</h2>',
      '<p>Describe saved articles, resources, notes, group materials, and revision items.</p>',
      '<h2>How organization improves learning</h2>',
      '<p>Explain the benefit of fewer scattered files and faster access during revision.</p>',
      '<h2>Recommended setup</h2>',
      '<p>Give readers a sample folder structure or weekly routine.</p>',
    ].join('\n'),
  },
  {
    id: 'contributors',
    name: 'Creators and contributors',
    category: 'Creators',
    tags: 'contributors, creators, earn, content',
    title: 'How contributors can share knowledge and build reputation on Sharether',
    description: 'A creator-focused article for explaining contribution, quality, visibility, and rewards.',
    body: [
      '<p>Sharether is not only a place to consume learning content. It is also a place for capable students, lecturers, and creators to publish useful work.</p>',
      '<h2>Who should contribute</h2>',
      '<p>Explain the type of creator or student this is for.</p>',
      '<h2>What good content looks like</h2>',
      '<p>List the standards: clarity, usefulness, accuracy, and relevance.</p>',
      '<h2>How contributors benefit</h2>',
      '<p>Cover reputation, community impact, and rewards where applicable.</p>',
    ].join('\n'),
  },
  {
    id: 'community',
    name: 'Community and support',
    category: 'Community',
    tags: 'community, support, groups, students',
    title: 'Building a stronger student learning community with Sharether',
    description: 'A community article template for study groups, peer support, mentorship, and student collaboration.',
    body: [
      '<p>Students learn better when they can ask questions, compare ideas, and find people working toward similar academic goals.</p>',
      '<h2>Where community fits</h2>',
      '<p>Describe the social or support feature being announced or explained.</p>',
      '<h2>How students should use it</h2>',
      '<p>Give practical guidance for helpful, respectful participation.</p>',
      '<h2>What comes next</h2>',
      '<p>Connect this community feature to upcoming improvements or roadmap items.</p>',
    ].join('\n'),
  },
];

const blankMember = () => ({
  id: `member_${Date.now()}`,
  name: '',
  aka: '',
  role: '',
  color: '#38bdf8',
  gradient: 'linear-gradient(135deg, #38bdf8 0%, #34d399 55%, #f97316 100%)',
  photo: '',
  contact: { email: '', phone: '', phone2: '' },
  bio: ['', ''],
});
const blankContributor = () => ({ id: `contrib_${Date.now()}`, name: '', role: '', aka: '' });
const blankDonor = () => ({ id: `donor_${Date.now()}`, name: '', from: '' });

const emptyBlogDraft = () => ({
  id: null,
  title: '',
  description: '',
  category: 'Platform',
  tagsText: 'platform, sharether',
  body: '',
  status: 'published',
});

function SectionHeader({ title, onAdd, addLabel }) {
  return (
    <div className="adm-card-header">
      <h3 className="adm-card-title">{title}</h3>
      {onAdd && (
        <button type="button" className="adm-btn adm-btn-outline" onClick={onAdd}>
          <FiPlus size={13} /> {addLabel}
        </button>
      )}
    </div>
  );
}

const normalizeBlog = (item) => ({
  id: item.id,
  title: item.title || '',
  description: item.description || '',
  category: item.category || item.metadata?.category || 'Platform',
  tagsText: Array.isArray(item.tags) ? item.tags.join(', ') : '',
  body: item.body || item.content || item.metadata?.body || '',
  status: item.status || 'published',
});

export default function PublishingSection() {
  const [team, setTeam] = useState({ core_team: [], content_support: [], notable_mentions: [], donors: [] });
  const [blogs, setBlogs] = useState([]);
  const [blogDraft, setBlogDraft] = useState(emptyBlogDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [toast, setToast] = useState('');
  const [deleteBlogTarget, setDeleteBlogTarget] = useState(null);

  const publishedCount = useMemo(() => blogs.filter((blog) => blog.status === 'published').length, [blogs]);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 2800);
  };

  const loadBlogs = async () => {
    const res = await api.admin.getContent({ type: 'blog', status: 'all', limit: 50 });
    if (res?.success) {
      setBlogs((res.content || []).map(normalizeBlog));
    }
  };

  useEffect(() => {
    Promise.all([
      api.admin.getSiteContent(),
      loadBlogs(),
    ])
      .then(([siteRes]) => {
        if (siteRes?.success) {
          setTeam(siteRes.content?.team || { core_team: [], content_support: [], notable_mentions: [], donors: [] });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const saveTeam = async () => {
    setSaving('team');
    try {
      const res = await api.admin.updateSiteContent('team', team);
      if (res?.success) {
        setTeam(res.value);
        showToast('Team page saved');
      }
    } finally {
      setSaving(null);
    }
  };

  const updateTeamItem = (bucket, index, patch) => {
    setTeam((current) => ({
      ...current,
      [bucket]: current[bucket].map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...patch } : item
      )),
    }));
  };

  const removeTeamItem = (bucket, index) => {
    setTeam((current) => ({
      ...current,
      [bucket]: current[bucket].filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const updateCoreMember = (index, patch) => {
    updateTeamItem('core_team', index, patch);
  };

  const applyTemplate = (templateId) => {
    const template = BLOG_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;
    setBlogDraft({
      id: null,
      title: template.title,
      description: template.description,
      category: template.category,
      tagsText: template.tags,
      body: template.body,
      status: 'published',
    });
  };

  const editBlog = (blog) => {
    setBlogDraft(normalizeBlog(blog));
  };

  const saveBlog = async () => {
    const title = blogDraft.title.trim();
    if (!title) {
      showToast('Blog title is required');
      return;
    }

    const tags = blogDraft.tagsText
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const payload = {
      type: 'blog',
      title,
      description: blogDraft.description.trim(),
      body: blogDraft.body,
      category: blogDraft.category.trim() || 'Platform',
      tags,
      status: blogDraft.status,
      metadata: {
        category: blogDraft.category.trim() || 'Platform',
        body: blogDraft.body,
        read_time: Math.max(1, Math.ceil((blogDraft.body || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length / 220)),
      },
    };

    setSaving('blog');
    try {
      const res = blogDraft.id
        ? await api.content.update(blogDraft.id, payload)
        : await api.content.create(payload);
      if (res?.success) {
        await loadBlogs();
        setBlogDraft(emptyBlogDraft());
        showToast(blogDraft.id ? 'Blog updated' : 'Blog published');
      } else {
        showToast(res?.error || 'Could not save blog');
      }
    } catch (error) {
      showToast(error.message || 'Could not save blog');
    } finally {
      setSaving(null);
    }
  };

  const deleteBlog = async (blog) => {
    setSaving(`delete-${blog.id}`);
    try {
      const res = await api.content.delete(blog.id);
      if (res?.success) {
        setBlogs((current) => current.filter((item) => item.id !== blog.id));
        if (blogDraft.id === blog.id) setBlogDraft(emptyBlogDraft());
        showToast('Blog deleted');
      }
    } finally {
      setSaving(null);
      setDeleteBlogTarget(null);
    }
  };

  if (loading) {
    return <div className="adm-loading"><div className="adm-spinner" /> Loading publishing workspace...</div>;
  }

  return (
    <>
      {deleteBlogTarget && (
        <div className="adm-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setDeleteBlogTarget(null);
        }}>
          <div className="adm-modal adm-modal-prompt" role="dialog" aria-modal="true" aria-labelledby="delete-blog-title">
            <div className="adm-modal-header">
              <div>
                <h3 id="delete-blog-title" className="adm-modal-title">Delete blog post</h3>
                <p className="adm-modal-kicker">{deleteBlogTarget.title}</p>
              </div>
              <button type="button" className="adm-modal-close" onClick={() => setDeleteBlogTarget(null)} disabled={!!saving} aria-label="Close delete dialog">&times;</button>
            </div>
            <div className="adm-modal-body adm-prompt-body">
              <p className="adm-prompt-message">This removes the blog post from the public Blog page and deletes it from the content library.</p>
            </div>
            <div className="adm-modal-footer">
              <button type="button" className="adm-btn adm-btn-outline" onClick={() => setDeleteBlogTarget(null)} disabled={!!saving}>Cancel</button>
              <button type="button" className="adm-btn adm-btn-danger-solid" onClick={() => deleteBlog(deleteBlogTarget)} disabled={saving === `delete-${deleteBlogTarget.id}`}>
                {saving === `delete-${deleteBlogTarget.id}` ? 'Deleting...' : 'Delete blog'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="adm-stats">
        <div className="adm-stat accent-blue">
          <div className="adm-stat-top"><span className="adm-stat-label">Blog Posts</span><span className="adm-stat-icon"><FiBookOpen /></span></div>
          <div className="adm-stat-value">{blogs.length}</div>
          <div className="adm-stat-change neutral">{publishedCount} published</div>
        </div>
        <div className="adm-stat accent-green">
          <div className="adm-stat-top"><span className="adm-stat-label">Core Team</span><span className="adm-stat-icon"><FiUsers /></span></div>
          <div className="adm-stat-value">{team.core_team.length}</div>
        </div>
      </div>

      {toast && <div className="adm-alert">{toast}</div>}

      <div className="adm-card">
        <SectionHeader title="Blog Studio" onAdd={() => setBlogDraft(emptyBlogDraft())} addLabel="New blog" />
        <div className="adm-card-body adm-blog-studio">
          <div className="adm-blog-template-row">
            {BLOG_TEMPLATES.map((template) => (
              <button key={template.id} type="button" className="adm-blog-template" onClick={() => applyTemplate(template.id)}>
                <strong>{template.name}</strong>
                <span>{template.category}</span>
              </button>
            ))}
          </div>

          <div className="adm-grid-2">
            <label className="adm-field-stack">
              <span>Title</span>
              <input className="adm-input adm-input-full" value={blogDraft.title} onChange={(event) => setBlogDraft((draft) => ({ ...draft, title: event.target.value }))} />
            </label>
            <label className="adm-field-stack">
              <span>Category</span>
              <input className="adm-input adm-input-full" value={blogDraft.category} onChange={(event) => setBlogDraft((draft) => ({ ...draft, category: event.target.value }))} />
            </label>
          </div>
          <label className="adm-field-stack">
            <span>Summary</span>
            <textarea className="adm-textarea adm-textarea-full" rows={3} value={blogDraft.description} onChange={(event) => setBlogDraft((draft) => ({ ...draft, description: event.target.value }))} />
          </label>
          <div className="adm-grid-2">
            <label className="adm-field-stack">
              <span>Tags</span>
              <input className="adm-input adm-input-full" value={blogDraft.tagsText} onChange={(event) => setBlogDraft((draft) => ({ ...draft, tagsText: event.target.value }))} placeholder="platform, study tips, practice" />
            </label>
            <label className="adm-field-stack">
              <span>Status</span>
              <select className="adm-select adm-select-full" value={blogDraft.status} onChange={(event) => setBlogDraft((draft) => ({ ...draft, status: event.target.value }))}>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </label>
          </div>
          <label className="adm-field-stack">
            <span>Article body</span>
            <textarea className="adm-textarea adm-textarea-full adm-blog-body-input" value={blogDraft.body} onChange={(event) => setBlogDraft((draft) => ({ ...draft, body: event.target.value }))} />
          </label>
          <div className="adm-card-actions">
            <button type="button" className="adm-btn adm-btn-outline" onClick={() => setBlogDraft(emptyBlogDraft())}>
              Clear
            </button>
            <button type="button" className="adm-btn adm-btn-primary" onClick={saveBlog} disabled={saving === 'blog'}>
              <FiSave size={13} /> {saving === 'blog' ? 'Saving...' : blogDraft.id ? 'Update blog' : 'Publish blog'}
            </button>
          </div>
        </div>
      </div>

      <div className="adm-card">
        <SectionHeader title="Blog Library" />
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Post</th>
                <th>Category</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {blogs.map((blog) => (
                <tr key={blog.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{blog.title}</div>
                    <div className="adm-muted-small">{blog.description}</div>
                  </td>
                  <td>{blog.category}</td>
                  <td><span className={`adm-badge ${blog.status === 'published' ? 'adm-badge-green' : 'adm-badge-gray'}`}>{blog.status}</span></td>
                  <td>
                    <div className="adm-inline-actions">
                      <button type="button" className="adm-mini-btn" onClick={() => editBlog(blog)}><FiEdit3 size={12} /> Edit</button>
                      <button type="button" className="adm-mini-btn adm-mini-btn-danger" onClick={() => setDeleteBlogTarget(blog)} disabled={saving === `delete-${blog.id}`}><FiTrash2 size={12} /> Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {blogs.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--adm-text-muted)', padding: 24 }}>No blog posts yet. Start with a template above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="adm-card">
        <SectionHeader title="Core Team" onAdd={() => setTeam((current) => ({ ...current, core_team: [...current.core_team, blankMember()] }))} addLabel="Add member" />
        <div className="adm-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {team.core_team.map((member, index) => (
            <div key={member.id} style={{ borderBottom: '1px solid var(--adm-border)', paddingBottom: 16 }}>
              <div className="adm-grid-3">
                <input className="adm-input" placeholder="Name" value={member.name || ''} onChange={(event) => updateCoreMember(index, { name: event.target.value })} />
                <input className="adm-input" placeholder="Role" value={member.role || ''} onChange={(event) => updateCoreMember(index, { role: event.target.value })} />
                <input className="adm-input" placeholder="AKA" value={member.aka || ''} onChange={(event) => updateCoreMember(index, { aka: event.target.value })} />
                <input className="adm-input" placeholder="Photo URL" value={member.photo || ''} onChange={(event) => updateCoreMember(index, { photo: event.target.value })} />
                <input className="adm-input" placeholder="Email" value={member.contact?.email || ''} onChange={(event) => updateCoreMember(index, { contact: { ...(member.contact || {}), email: event.target.value } })} />
                <input className="adm-input" placeholder="Phone" value={member.contact?.phone || ''} onChange={(event) => updateCoreMember(index, { contact: { ...(member.contact || {}), phone: event.target.value } })} />
                <input className="adm-input" placeholder="Phone 2" value={member.contact?.phone2 || ''} onChange={(event) => updateCoreMember(index, { contact: { ...(member.contact || {}), phone2: event.target.value } })} />
              </div>
              <textarea className="adm-textarea adm-textarea-full" style={{ marginTop: 10, minHeight: 70 }} placeholder="Bio paragraph 1" value={member.bio?.[0] || ''} onChange={(event) => updateCoreMember(index, { bio: [event.target.value, member.bio?.[1] || ''] })} />
              <textarea className="adm-textarea adm-textarea-full" style={{ marginTop: 10, minHeight: 70 }} placeholder="Bio paragraph 2" value={member.bio?.[1] || ''} onChange={(event) => updateCoreMember(index, { bio: [member.bio?.[0] || '', event.target.value] })} />
              <button type="button" className="adm-btn adm-btn-ghost" style={{ marginTop: 10, color: 'var(--adm-red)' }} onClick={() => removeTeamItem('core_team', index)}>
                <FiTrash2 size={14} /> Remove member
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="adm-card">
        <SectionHeader title="Content & Support" onAdd={() => setTeam((current) => ({ ...current, content_support: [...(current.content_support || []), blankContributor()] }))} addLabel="Add member" />
        <div className="adm-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(team.content_support || []).map((item, index) => (
            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
              <input className="adm-input" placeholder="Name" value={item.name || ''} onChange={(event) => updateTeamItem('content_support', index, { name: event.target.value })} />
              <input className="adm-input" placeholder="Role" value={item.role || ''} onChange={(event) => updateTeamItem('content_support', index, { role: event.target.value })} />
              <button type="button" className="adm-btn adm-btn-ghost" style={{ color: 'var(--adm-red)' }} onClick={() => removeTeamItem('content_support', index)}><FiTrash2 size={14} /></button>
              <input className="adm-input adm-input-full" style={{ gridColumn: '1 / -1' }} placeholder="AKA" value={item.aka || ''} onChange={(event) => updateTeamItem('content_support', index, { aka: event.target.value })} />
            </div>
          ))}
        </div>
      </div>

      <div className="adm-grid-2">
        <div className="adm-card">
          <SectionHeader title="Notable Mentions" onAdd={() => setTeam((current) => ({ ...current, notable_mentions: [...(current.notable_mentions || []), blankContributor()] }))} addLabel="Add mention" />
          <div className="adm-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(team.notable_mentions || []).map((item, index) => (
              <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
                <input className="adm-input" placeholder="Name" value={item.name || ''} onChange={(event) => updateTeamItem('notable_mentions', index, { name: event.target.value })} />
                <input className="adm-input" placeholder="Role / title" value={item.role || ''} onChange={(event) => updateTeamItem('notable_mentions', index, { role: event.target.value })} />
                <button type="button" className="adm-btn adm-btn-ghost" style={{ color: 'var(--adm-red)' }} onClick={() => removeTeamItem('notable_mentions', index)}><FiTrash2 size={14} /></button>
                <input className="adm-input adm-input-full" style={{ gridColumn: '1 / -1' }} placeholder="AKA" value={item.aka || ''} onChange={(event) => updateTeamItem('notable_mentions', index, { aka: event.target.value })} />
              </div>
            ))}
          </div>
        </div>

        <div className="adm-card">
          <SectionHeader title="Contributors" onAdd={() => setTeam((current) => ({ ...current, donors: [...current.donors, blankDonor()] }))} addLabel="Add contributor" />
          <div className="adm-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(team.donors || []).map((item, index) => (
              <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
                <input className="adm-input" placeholder="Name" value={item.name || ''} onChange={(event) => updateTeamItem('donors', index, { name: event.target.value })} />
                <input className="adm-input" placeholder="From" value={item.from || ''} onChange={(event) => updateTeamItem('donors', index, { from: event.target.value })} />
                <button type="button" className="adm-btn adm-btn-ghost" style={{ color: 'var(--adm-red)' }} onClick={() => removeTeamItem('donors', index)}><FiTrash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <button type="button" className="adm-btn adm-btn-primary" onClick={saveTeam} disabled={saving === 'team'}>
          <FiSave size={13} /> {saving === 'team' ? 'Saving...' : 'Save team page'}
        </button>
      </div>
    </>
  );
}
