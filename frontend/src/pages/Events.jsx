import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import PageHeader from '../components/common/PageHeader';
import SectionHeadingIcon from '../components/common/SectionHeadingIcon';
import './SharedPages.css';

const EVENTS = [
  {
    id: 'evt-1',
    title: 'JAMB Countdown Bootcamp',
    date: '2026-04-18',
    displayDate: 'Apr 18, 2026',
    time: '6:00 PM',
    type: 'Bootcamp',
    location: 'Online',
  },
  {
    id: 'evt-2',
    title: 'Chemistry Revision Night',
    date: '2026-04-26',
    displayDate: 'Apr 26, 2026',
    time: '5:30 PM',
    type: 'Study session',
    location: 'Lagos Hub',
  },
  {
    id: 'evt-3',
    title: 'Mentor AMA: Physics',
    date: '2026-05-03',
    displayDate: 'May 03, 2026',
    time: '7:00 PM',
    type: 'AMA',
    location: 'Online',
  },
];

const formatEventSummary = (event) => `${event.title} on ${event.displayDate} at ${event.time}`;

export default function Events() {
  const { user } = useAuth();
  const [activeType, setActiveType] = useState('All');
  const [selectedEventId, setSelectedEventId] = useState(EVENTS[0].id);
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    note: '',
  });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const types = ['All', ...new Set(EVENTS.map((event) => event.type))];

  useEffect(() => {
    setFormState((previous) => ({
      ...previous,
      name:
        previous.name ||
        user?.full_name ||
        user?.name ||
        [user?.first_name, user?.last_name].filter(Boolean).join(' '),
      email: previous.email || user?.email || '',
    }));
  }, [user]);

  const visibleEvents = useMemo(() => {
    if (activeType === 'All') return EVENTS;
    return EVENTS.filter((event) => event.type === activeType);
  }, [activeType]);

  const selectedEvent = EVENTS.find((event) => event.id === selectedEventId) || EVENTS[0];

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const registerInterest = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus('');
    setError('');

    try {
      await api.support.submitReport({
        name: formState.name,
        email: formState.email,
        subject: `Campus ambassador event registration: ${selectedEvent.title}`,
        category: 'Community',
        message: [
          `Event: ${formatEventSummary(selectedEvent)}`,
          `Location: ${selectedEvent.location}`,
          formState.note ? `Note: ${formState.note}` : null,
        ].filter(Boolean).join('\n'),
      });
      setStatus(`Registration interest sent for ${selectedEvent.title}. The team will follow up by email.`);
      setFormState((previous) => ({ ...previous, note: '' }));
    } catch (submitError) {
      setError(submitError.message || 'Unable to register interest right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadReminder = (event) => {
    const startDate = new Date(`${event.date}T18:00:00`);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    const pad = (value) => String(value).padStart(2, '0');
    const toIcsDate = (dateValue) => (
      `${dateValue.getUTCFullYear()}${pad(dateValue.getUTCMonth() + 1)}${pad(dateValue.getUTCDate())}T${pad(dateValue.getUTCHours())}${pad(dateValue.getUTCMinutes())}00Z`
    );

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Learnda//Campus Events//EN',
      'BEGIN:VEVENT',
      `UID:${event.id}@learnda.app`,
      `DTSTAMP:${toIcsDate(new Date())}`,
      `DTSTART:${toIcsDate(startDate)}`,
      `DTEND:${toIcsDate(endDate)}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.type} hosted by Learnda`,
      `LOCATION:${event.location}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${event.id}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-shell">
      <PageHeader icon="events" title="Events" description="Learning events for schools and communities.">
        <button className="btn btn-primary" type="button" onClick={() => document.getElementById('upcoming-events')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          View calendar
        </button>
        <button className="btn btn-secondary" type="button" onClick={() => document.getElementById('event-registration')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          Register interest
        </button>
      </PageHeader>

      <section className="page-section" id="upcoming-events">
        <div className="section-heading">
          <h2><SectionHeadingIcon name="events" /><span className="section-heading__title">Upcoming events</span></h2>
          <p>Select a format to find the right session.</p>
        </div>
        <div className="tab-row">
          {types.map((type) => (
            <button
              key={type}
              className={`tab-button ${activeType === type ? 'active' : ''}`}
              onClick={() => setActiveType(type)}
              type="button"
            >
              {type}
            </button>
          ))}
        </div>
        <div className="card-grid">
          {visibleEvents.map((event) => (
            <div key={event.id} className="info-card">
              <h3>{event.title}</h3>
              <p>{event.displayDate} - {event.time}</p>
              <div className="pill-row">
                <span className="pill">{event.type}</span>
                <span className="pill">{event.location}</span>
              </div>
              <div className="form-actions">
                <button className="btn btn-primary" type="button" onClick={() => {
                  setSelectedEventId(event.id);
                  document.getElementById('event-registration')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}>
                  Register
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => downloadReminder(event)}>
                  Add reminder
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="page-section" id="event-registration">
        <div className="section-heading">
          <h2><SectionHeadingIcon name="stories" /><span className="section-heading__title">Register interest</span></h2>
          <p>Tell us which event you want to join and the team will follow up with the next step.</p>
        </div>
        <form className="form-card" onSubmit={registerInterest}>
          <div className="form-grid">
            <div className="form-row">
              <label htmlFor="event-name">Full name</label>
              <input
                id="event-name"
                name="name"
                type="text"
                value={formState.name}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-row">
              <label htmlFor="event-email">Email</label>
              <input
                id="event-email"
                name="email"
                type="email"
                value={formState.email}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-row">
              <label htmlFor="event-select">Event</label>
              <select
                id="event-select"
                value={selectedEventId}
                onChange={(event) => setSelectedEventId(event.target.value)}
              >
                {EVENTS.map((event) => (
                  <option key={event.id} value={event.id}>
                    {formatEventSummary(event)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <label htmlFor="event-note">Note</label>
            <textarea
              id="event-note"
              name="note"
              rows="4"
              value={formState.note}
              onChange={handleChange}
              placeholder="Tell us if you want to volunteer, attend, or host on your campus."
            />
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Sending...' : 'Send registration'}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => downloadReminder(selectedEvent)}>
              Download calendar invite
            </button>
          </div>

          {status ? <p className="pricing-inline-feedback success status-inline">{status}</p> : null}
          {error ? <p className="pricing-inline-feedback error status-inline">{error}</p> : null}
        </form>
      </section>
    </div>
  );
}
