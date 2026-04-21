import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection, addDoc, onSnapshot, serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import { CITIES } from './cities';
import { findMatches, MATCH_LABELS } from './matching';
import './App.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const timeAgo = (ts) => {
  if (!ts?.toMillis) return '';
  const sec = Math.floor((Date.now() - ts.toMillis()) / 1000);
  if (sec < 60) return 'עכשיו';
  if (sec < 3600) return `לפני ${Math.floor(sec / 60)} דק׳`;
  return `לפני ${Math.floor(sec / 3600)} שע׳`;
};

// Open WhatsApp with a pre-filled context message
const openWhatsApp = (phone, post) => {
  const clean = phone.replace(/\D/g, '');
  const intl = clean.startsWith('0') ? '972' + clean.slice(1) : clean;

  const postType = post.type === 'offering'
    ? `ראיתי שיש לך מקום באוטו מ${post.from}`
    : `ראיתי שאתה מחפש/ת טרמפ מ${post.from}`;

  const msg = encodeURIComponent(
    `היי! 👋 ראיתי את המודעה שלך בלוח הטרמפים של ג׳ימבו ג׳יי בקיסריה (13.5) 🎵\n${postType}.\nאני מעוניין/ת — נתאם פרטים? 🚗`,
  );
  window.open(`https://wa.me/${intl}?text=${msg}`, '_blank');
};

const callPhone = (phone) => {
  window.location.href = `tel:${phone}`;
};

// ─── Match Toasts ─────────────────────────────────────────────────────────────

function MatchToast({ notifications, onDismiss }) {
  if (!notifications.length) return null;
  return (
    <div className="match-toasts">
      {notifications.map((n) => (
        <div key={n.id} className="match-toast">
          <span className="toast-emoji">🎯</span>
          <div className="toast-body">
            <strong>אולי יש התאמה!</strong>
            <p>{n.message}</p>
          </div>
          <button className="toast-close" onClick={() => onDismiss(n.id)}>×</button>
        </div>
      ))}
    </div>
  );
}

// ─── Ride Card ────────────────────────────────────────────────────────────────

function RideCard({ post, allPosts }) {
  const [expanded, setExpanded] = useState(false);
  const isOffering = post.type === 'offering';
  const matches = findMatches(post, allPosts);
  const bestMatch = matches[0];

  const handleContact = () => {
    if (post.contactType === 'whatsapp' || post.contactType === 'phone') {
      if (post.contactType === 'whatsapp') {
        openWhatsApp(post.contact, post);
      } else {
        callPhone(post.contact);
      }
    } else {
      window.location.href = `mailto:${post.contact}?subject=טרמפ לג'ימבו ג'יי&body=${encodeURIComponent(`היי! ראיתי את המודעה שלך בלוח הטרמפים של ג'ימבו ג'יי בקיסריה. אני מעוניין/ת — נתאם פרטים?`)}`;
    }
  };

  const dirLabel = {
    going: '→ הלוך',
    return: '← חזרה',
    both: '↔ הלוך ושוב',
  }[post.direction] || '';

  return (
    <div className={`card ${isOffering ? 'card-offering' : 'card-seeking'}`}>
      {/* Header row */}
      <div className="card-top">
        <div className="card-top-left">
          <span className={`type-badge ${isOffering ? 'badge-offer' : 'badge-seek'}`}>
            {isOffering ? '🚗 מסיע' : '✋ מחפש טרמפ'}
          </span>
          {bestMatch && (
            <span
              className="match-pill"
              style={{ background: MATCH_LABELS[bestMatch.quality].color }}
              onClick={() => setExpanded(!expanded)}
            >
              {MATCH_LABELS[bestMatch.quality].emoji} {matches.length} התאמה
            </span>
          )}
        </div>
        <span className="card-time">{timeAgo(post.createdAt)}</span>
      </div>

      {/* City */}
      <div className="card-city-row">
        <span className="city-pin">📍</span>
        <span className="card-city">{post.from}</span>
        {dirLabel && <span className="dir-chip">{dirLabel}</span>}
      </div>

      {/* Chips */}
      <div className="chips-row">
        {post.departureTime && <span className="chip">🕐 {post.departureTime}</span>}
        {isOffering ? (
          <>
            <span className="chip">💺 {post.seats} מקומות</span>
            <span className={`chip ${post.costType === 'free' ? 'chip-free' : 'chip-fuel'}`}>
              {post.costType === 'free' ? '🎁 חינם' : '⛽ השתתפות בדלק'}
            </span>
          </>
        ) : (
          <span className="chip">👥 {post.passengers} {post.passengers === 1 ? 'איש' : 'אנשים'}</span>
        )}
      </div>

      {post.name && <p className="card-name">👤 {post.name}</p>}

      {/* Matches accordion */}
      {matches.length > 0 && (
        <div className="matches-box">
          <button className="matches-toggle" onClick={() => setExpanded(!expanded)}>
            <span>{MATCH_LABELS[bestMatch.quality].emoji} {matches.length} התאמ{matches.length === 1 ? 'ה' : 'ות'} אפשרי{matches.length === 1 ? 'ת' : 'ות'}</span>
            <span>{expanded ? '▲' : '▼'}</span>
          </button>
          {expanded && (
            <div className="matches-list">
              {matches.map((m) => {
                const lbl = MATCH_LABELS[m.quality];
                return (
                  <div key={m.post.id} className="match-row" style={{ borderRight: `3px solid ${lbl.color}` }}>
                    <span>{m.post.type === 'offering' ? '🚗' : '✋'} <strong>{m.post.from}</strong></span>
                    <span className="match-tag" style={{ background: lbl.color }}>{lbl.text}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CTA */}
      <button className="cta-btn" onClick={handleContact}>
        {post.contactType === 'whatsapp'
          ? '💬 שלח וואטסאפ'
          : post.contactType === 'phone'
          ? '📞 התקשר'
          : '✉️ שלח מייל'}
      </button>
    </div>
  );
}

// ─── Post Form ────────────────────────────────────────────────────────────────

const DEPARTURE_TIMES = [
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
  '21:00', '22:00 (אחרי ההופעה)', '23:00 (אחרי ההופעה)', '00:00 (אחרי ההופעה)',
];

const SORTED_CITIES = [...CITIES].sort((a, b) => a.name.localeCompare(b.name, 'he'));

function PostModal({ onClose, onSubmit, loading }) {
  const [type, setType] = useState('offering');
  const [from, setFrom] = useState('');
  const [direction, setDirection] = useState('going');
  const [departureTime, setDepartureTime] = useState('');
  const [seats, setSeats] = useState(2);
  const [passengers, setPassengers] = useState(1);
  const [costType, setCostType] = useState('');
  const [contactType, setContactType] = useState('whatsapp');
  const [contact, setContact] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState({});
  const overlayRef = useRef();

  const validate = () => {
    const e = {};
    if (!from) e.from = 'בחר/י עיר';
    if (!contact.trim()) e.contact = 'שדה חובה';
    if (type === 'offering' && !costType) e.costType = 'שדה חובה';
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSubmit({ type, from, direction, departureTime, seats, passengers, costType: type === 'seeking' ? null : costType, contactType, contact: contact.trim(), name: name.trim() });
  };

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={(e) => e.target === overlayRef.current && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">🎵 פרסם טרמפ</h2>
          <button className="modal-x" onClick={onClose}>×</button>
        </div>

        {/* Type toggle */}
        <div className="type-toggle">
          <button
            type="button"
            className={`toggle-btn ${type === 'offering' ? 'toggle-offer-active' : ''}`}
            onClick={() => setType('offering')}
          >🚗 יש לי מקום</button>
          <button
            type="button"
            className={`toggle-btn ${type === 'seeking' ? 'toggle-seek-active' : ''}`}
            onClick={() => setType('seeking')}
          >✋ מחפש טרמפ</button>
        </div>

        <form onSubmit={handleSubmit} className="form" noValidate>

          {/* City */}
          <div className="field">
            <label className="field-label">📍 מאיפה יוצאים?</label>
            <select
              className={`field-input ${errors.from ? 'field-error' : ''}`}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            >
              <option value="">-- בחר/י עיר --</option>
              {SORTED_CITIES.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
            {errors.from && <span className="err">{errors.from}</span>}
          </div>

          {/* Direction */}
          <div className="field">
            <label className="field-label">🔄 כיוון נסיעה</label>
            <div className="pill-group">
              {[
                { v: 'going', l: '→ לקיסריה' },
                { v: 'return', l: '← חזרה' },
                { v: 'both', l: '↔ שניהם' },
              ].map(({ v, l }) => (
                <button
                  key={v} type="button"
                  className={`pill-btn ${direction === v ? 'pill-active' : ''}`}
                  onClick={() => setDirection(v)}
                >{l}</button>
              ))}
            </div>
          </div>

          {/* Time */}
          <div className="field">
            <label className="field-label">🕐 שעת יציאה (בערך)</label>
            <select
              className="field-input"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
            >
              <option value="">לא יודע/ת עדיין</option>
              {DEPARTURE_TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Seats / Passengers counter */}
          <div className="field">
            <label className="field-label">
              {type === 'offering' ? '💺 כמה מקומות פנויים?' : '👥 כמה אנשים מחפשים?'}
            </label>
            <div className="counter">
              <button
                type="button" className="counter-btn"
                onClick={() => type === 'offering'
                  ? setSeats((s) => Math.max(1, s - 1))
                  : setPassengers((p) => Math.max(1, p - 1))}
              >−</button>
              <span className="counter-num">{type === 'offering' ? seats : passengers}</span>
              <button
                type="button" className="counter-btn"
                onClick={() => type === 'offering'
                  ? setSeats((s) => Math.min(8, s + 1))
                  : setPassengers((p) => Math.min(6, p + 1))}
              >+</button>
            </div>
          </div>

          {/* Cost — drivers only, required */}
          {type === 'offering' && (
            <div className="field">
              <label className="field-label">💰 תנאי הנסיעה <span className="req">*חובה</span></label>
              <div className="pill-group">
                <button
                  type="button"
                  className={`pill-btn ${costType === 'free' ? 'pill-free' : ''}`}
                  onClick={() => setCostType('free')}
                >🎁 חינם לגמרי</button>
                <button
                  type="button"
                  className={`pill-btn ${costType === 'fuel' ? 'pill-fuel' : ''}`}
                  onClick={() => setCostType('fuel')}
                >⛽ השתתפות בדלק</button>
              </div>
              {errors.costType && <span className="err">{errors.costType}</span>}
            </div>
          )}

          {/* Contact type */}
          <div className="field">
            <label className="field-label">📱 איך ליצור קשר?</label>
            <div className="pill-group">
              {[
                { v: 'whatsapp', l: '💬 וואטסאפ' },
                { v: 'phone', l: '📞 טלפון' },
                { v: 'email', l: '✉️ מייל' },
              ].map(({ v, l }) => (
                <button
                  key={v} type="button"
                  className={`pill-btn ${contactType === v ? 'pill-active' : ''}`}
                  onClick={() => setContactType(v)}
                >{l}</button>
              ))}
            </div>
          </div>

          {/* Contact value */}
          <div className="field">
            <label className="field-label">
              {contactType === 'email' ? '✉️ כתובת מייל' : '📱 מספר טלפון'}
            </label>
            <input
              className={`field-input ${errors.contact ? 'field-error' : ''}`}
              type={contactType === 'email' ? 'email' : 'tel'}
              placeholder={contactType === 'email' ? 'name@example.com' : '05X-XXXXXXX'}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              inputMode={contactType === 'email' ? 'email' : 'numeric'}
            />
            {errors.contact && <span className="err">{errors.contact}</span>}
          </div>

          {/* Name optional */}
          <div className="field">
            <label className="field-label">👤 שם (אופציונלי)</label>
            <input
              className="field-input"
              type="text"
              placeholder="השם שלך"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? '⏳ שולח...' : '🎵 פרסם!'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [posts, setPosts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [dbError, setDbError] = useState(false);
  const prevIdsRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, 'rides'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Detect new posts and notify about matches
        if (prevIdsRef.current !== null) {
          const added = all.filter((p) => !prevIdsRef.current.has(p.id));
          added.forEach((newPost) => {
            const matches = findMatches(newPost, all);
            if (matches.length > 0) {
              const best = matches[0];
              const lbl = MATCH_LABELS[best.quality];
              const nid = `${Date.now()}-${Math.random()}`;
              const isDriver = newPost.type === 'offering';
              setNotifications((prev) => [
                ...prev,
                {
                  id: nid,
                  message: `${isDriver ? 'נהג/ת' : 'נוסע/ת'} מ${newPost.from} ${lbl.emoji} ${lbl.text} — ${matches.length} ${matches.length === 1 ? 'הצעה' : 'הצעות'} מתאימות!`,
                },
              ]);
              setTimeout(() => {
                setNotifications((p) => p.filter((n) => n.id !== nid));
              }, 7000);
            }
          });
        }

        prevIdsRef.current = new Set(all.map((p) => p.id));
        setPosts(all);
        setDbError(false);
      },
      (err) => {
        console.error(err);
        setDbError(true);
      },
    );
    return unsub;
  }, []);

  const handleSubmit = useCallback(async (form) => {
    setLoading(true);
    try {
      await addDoc(collection(db, 'rides'), {
        ...form,
        createdAt: serverTimestamp(),
      });
      setShowModal(false);
    } catch (err) {
      console.error(err);
      alert('שגיאה בשמירה — בדוק חיבור ונסה שוב.');
    } finally {
      setLoading(false);
    }
  }, []);

  const filtered = posts.filter((p) =>
    filter === 'all' ? true : p.type === filter,
  );
  const offeringCount = posts.filter((p) => p.type === 'offering').length;
  const seekingCount  = posts.filter((p) => p.type === 'seeking').length;

  return (
    <div className="app" dir="rtl" lang="he">

      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <p className="header-sub">קיסריה • 13 במאי 2025</p>
          <h1 className="header-title">ג׳ימבו ג׳יי ולהקת ספא</h1>
          <div className="header-badge">🚗 לוח טרמפים</div>
        </div>
      </header>

      {/* Notifications */}
      <MatchToast
        notifications={notifications}
        onDismiss={(id) => setNotifications((p) => p.filter((n) => n.id !== id))}
      />

      {dbError && (
        <div className="offline-bar">⚠️ בעיית חיבור — מנסה להתחבר...</div>
      )}

      {/* Filter tabs */}
      <div className="filter-bar">
        <button
          className={`filter-tab ${filter === 'all' ? 'tab-active' : ''}`}
          onClick={() => setFilter('all')}
        >הכל <span className="tab-count">{posts.length}</span></button>
        <button
          className={`filter-tab ${filter === 'offering' ? 'tab-active tab-offer' : ''}`}
          onClick={() => setFilter('offering')}
        >🚗 מסיעים <span className="tab-count">{offeringCount}</span></button>
        <button
          className={`filter-tab ${filter === 'seeking' ? 'tab-active tab-seek' : ''}`}
          onClick={() => setFilter('seeking')}
        >✋ מחפשים <span className="tab-count">{seekingCount}</span></button>
      </div>

      {/* Board */}
      <main className="board">
        {filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🎵</div>
            <p className="empty-title">אין פוסטים עדיין</p>
            <p className="empty-sub">היה/י הראשון/ה לפרסם!</p>
          </div>
        ) : (
          <div className="cards-grid">
            {filtered.map((p) => (
              <RideCard key={p.id} post={p} allPosts={posts} />
            ))}
          </div>
        )}
      </main>

      {/* FAB */}
      <button className="fab" onClick={() => setShowModal(true)} aria-label="פרסם טרמפ">
        <span className="fab-plus">+</span> פרסם טרמפ
      </button>

      {showModal && (
        <PostModal
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          loading={loading}
        />
      )}
    </div>
  );
}
