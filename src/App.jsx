import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import { CITIES } from './cities';
import { findMatches, MATCH_LABELS } from './matching';
import concertImg from './assets/jimbo-concert.png';
import html2canvas from 'html2canvas';
import './App.css';

// ─── 4-digit PIN identity ─────────────────────────────────────────────────────

const getSavedPin = () => localStorage.getItem('jimbo_pin') || '';
const savePin     = (pin) => localStorage.setItem('jimbo_pin', pin);

// Generate a unique 4-digit PIN not already in use by existing posts
const generateUniquePin = (posts) => {
  const used = new Set(posts.map((p) => p.userPin).filter(Boolean));
  let pin, attempts = 0;
  do {
    pin = String(Math.floor(1000 + Math.random() * 9000));
    attempts++;
  } while (used.has(pin) && attempts < 100);
  return pin;
};

// ─── Bus SVG (inline so CSS wheel animation works reliably) ───────────────────

function BusSvg({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 210" fill="none" className={className}>
      <defs>
        <linearGradient id="busBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#8b21c8"/>
          <stop offset="45%"  stopColor="#6d14a8"/>
          <stop offset="100%" stopColor="#3d0870"/>
        </linearGradient>
        <linearGradient id="topStripe" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#e91e8c"/>
          <stop offset="50%"  stopColor="#ff6bc1"/>
          <stop offset="100%" stopColor="#e91e8c"/>
        </linearGradient>
        <linearGradient id="glass" x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0%"   stopColor="#c084fc" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#7e22ce" stopOpacity="0.65"/>
        </linearGradient>
        <linearGradient id="windshield" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%"   stopColor="#e0c4ff" stopOpacity="0.95"/>
          <stop offset="100%" stopColor="#9333ea" stopOpacity="0.7"/>
        </linearGradient>
        <radialGradient id="tire" cx="42%" cy="35%" r="58%">
          <stop offset="0%"   stopColor="#374151"/>
          <stop offset="100%" stopColor="#060b14"/>
        </radialGradient>
        <radialGradient id="rim" cx="38%" cy="32%" r="55%">
          <stop offset="0%"   stopColor="#f3f4f6"/>
          <stop offset="70%"  stopColor="#9ca3af"/>
          <stop offset="100%" stopColor="#6b7280"/>
        </radialGradient>
        <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#fef9c3" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#fef9c3" stopOpacity="0"/>
        </linearGradient>
        <radialGradient id="shadow" cx="50%" cy="15%" r="50%">
          <stop offset="0%"   stopColor="#000" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#000" stopOpacity="0"/>
        </radialGradient>
        <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#fff" stopOpacity="0.22"/>
          <stop offset="100%" stopColor="#fff" stopOpacity="0"/>
        </linearGradient>
      </defs>

      {/* Headlight beam */}
      <polygon points="400,118 480,90 480,155 400,148" fill="url(#beam)" opacity="0.35"/>

      {/* Ground shadow */}
      <ellipse cx="240" cy="178" rx="190" ry="7" fill="url(#shadow)"/>

      {/* Bus body */}
      <rect x="42" y="72" width="380" height="108" rx="10" fill="url(#busBody)" stroke="#9333ea" strokeWidth="2.2"/>
      <rect x="42" y="72" width="380" height="18" rx="10" fill="url(#topStripe)"/>
      <rect x="42" y="82" width="380" height="8" fill="url(#topStripe)"/>
      <rect x="44" y="92" width="376" height="28" rx="4" fill="url(#gloss)"/>
      <rect x="42" y="158" width="380" height="22" fill="#2e0658" opacity="0.55"/>
      <rect x="42" y="169" width="380" height="11" fill="#1a0030" opacity="0.6"/>

      {/* Destination sign */}
      <rect x="310" y="75" width="100" height="20" rx="4" fill="#0a0018" stroke="#e91e8c" strokeWidth="1.2"/>
      <text x="360" y="89" fontFamily="Arial, sans-serif" fontSize="9.5" fontWeight="bold"
            fill="#e91e8c" textAnchor="middle" letterSpacing="1">קיסריה 13.5 🎵</text>

      {/* Front face */}
      <rect x="400" y="80" width="22" height="98" rx="8" fill="#5b10a0" stroke="#9333ea" strokeWidth="1.8"/>
      <rect x="394" y="85" width="28" height="62" rx="6" fill="url(#windshield)" stroke="#c084fc" strokeWidth="1.5"/>
      <rect x="397" y="88" width="14" height="18" rx="3" fill="white" opacity="0.18"/>
      <rect x="396" y="152" width="30" height="12" rx="5" fill="#4c0d8f" stroke="#9333ea" strokeWidth="1.5"/>
      <rect x="399" y="156" width="24" height="4" rx="2" fill="#a78bfa" opacity="0.5"/>

      {/* Rear face */}
      <rect x="42" y="80" width="16" height="98" rx="6" fill="#5b10a0" stroke="#9333ea" strokeWidth="1.5"/>
      <rect x="38" y="152" width="24" height="12" rx="5" fill="#4c0d8f" stroke="#9333ea" strokeWidth="1.5"/>

      {/* Windows */}
      <rect x="55" y="95" width="332" height="52" rx="4" fill="#200040" opacity="0.5"/>
      {[60, 124, 188, 252].map((x) => (
        <g key={x}>
          <rect x={x} y="98" width="54" height="46" rx="5" fill="url(#glass)" stroke="#c084fc" strokeWidth="1.3"/>
          <rect x={x+2} y="100" width="27" height="14" rx="3" fill="white" opacity="0.13"/>
        </g>
      ))}
      <rect x="316" y="98" width="66" height="46" rx="5" fill="url(#glass)" stroke="#c084fc" strokeWidth="1.3"/>
      <rect x="318" y="100" width="33" height="14" rx="3" fill="white" opacity="0.13"/>

      {/* Driver */}
      <circle cx="356" cy="108" r="9" fill="#12001f" opacity="0.85"/>
      <path d="M 347 118 Q 347 114 356 114 Q 365 114 365 118 L 366 135 L 346 135 Z" fill="#12001f" opacity="0.75"/>

      {/* Door */}
      <line x1="116" y1="95" x2="116" y2="180" stroke="#9333ea" strokeWidth="1.8" opacity="0.7"/>
      <rect x="92" y="135" width="18" height="5" rx="2.5" fill="#c084fc" stroke="#e0c4ff" strokeWidth="0.8"/>

      {/* Headlights */}
      <rect x="410" y="108" width="22" height="16" rx="5" fill="#fef08a" stroke="#fbbf24" strokeWidth="1.5"/>
      <rect x="413" y="111" width="14" height="9" rx="3" fill="#fde047"/>
      <rect x="415" y="112" width="5" height="3" rx="1" fill="white" opacity="0.75"/>
      <rect x="410" y="126" width="22" height="5" rx="2" fill="#fcd34d" opacity="0.9"/>

      {/* Tail lights */}
      <rect x="44" y="105" width="14" height="26" rx="5" fill="#dc2626" stroke="#f87171" strokeWidth="1.2"/>
      <rect x="46" y="107" width="6" height="10" rx="2" fill="#fca5a5" opacity="0.7"/>
      <rect x="44" y="133" width="14" height="8" rx="3" fill="white" opacity="0.55"/>

      {/* Rear wheel — static outer, rotating inner via CSS */}
      <circle cx="118" cy="177" r="32" fill="url(#tire)" stroke="#374151" strokeWidth="2.2"/>
      <g className="wheel-rear">
        <circle cx="118" cy="177" r="30" fill="none" stroke="#4b5563" strokeWidth="4.5" strokeDasharray="9 5"/>
        <circle cx="118" cy="177" r="22" fill="url(#rim)"/>
        <circle cx="118" cy="177" r="20" fill="#1c2333" stroke="#6b7280" strokeWidth="1"/>
        <line x1="118" y1="158" x2="118" y2="173" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round"/>
        <line x1="118" y1="181" x2="118" y2="196" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round"/>
        <line x1="99"  y1="177" x2="114" y2="177" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round"/>
        <line x1="122" y1="177" x2="137" y2="177" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round"/>
        <line x1="105" y1="163" x2="114" y2="172" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round"/>
        <line x1="122" y1="182" x2="131" y2="191" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round"/>
        <line x1="131" y1="163" x2="122" y2="172" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round"/>
        <line x1="114" y1="182" x2="105" y2="191" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round"/>
        <circle cx="118" cy="177" r="7" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.2"/>
        <circle cx="118" cy="177" r="3" fill="#6b7280"/>
      </g>

      {/* Front wheel — static outer, rotating inner via CSS */}
      <circle cx="348" cy="177" r="32" fill="url(#tire)" stroke="#374151" strokeWidth="2.2"/>
      <g className="wheel-front">
        <circle cx="348" cy="177" r="30" fill="none" stroke="#4b5563" strokeWidth="4.5" strokeDasharray="9 5"/>
        <circle cx="348" cy="177" r="22" fill="url(#rim)"/>
        <circle cx="348" cy="177" r="20" fill="#1c2333" stroke="#6b7280" strokeWidth="1"/>
        <line x1="348" y1="158" x2="348" y2="173" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round"/>
        <line x1="348" y1="181" x2="348" y2="196" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round"/>
        <line x1="329" y1="177" x2="344" y2="177" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round"/>
        <line x1="352" y1="177" x2="367" y2="177" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round"/>
        <line x1="335" y1="163" x2="344" y2="172" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round"/>
        <line x1="352" y1="182" x2="361" y2="191" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round"/>
        <line x1="361" y1="163" x2="352" y2="172" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round"/>
        <line x1="344" y1="182" x2="335" y2="191" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round"/>
        <circle cx="348" cy="177" r="7" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.2"/>
        <circle cx="348" cy="177" r="3" fill="#6b7280"/>
      </g>

      {/* Speed lines */}
      <line x1="2"  y1="98"  x2="38" y2="98"  stroke="#e91e8c" strokeWidth="3.5" strokeLinecap="round" opacity="0.65"/>
      <line x1="0"  y1="112" x2="38" y2="112" stroke="#c026d3" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
      <line x1="6"  y1="126" x2="38" y2="126" stroke="#e91e8c" strokeWidth="2"   strokeLinecap="round" opacity="0.4"/>
      <line x1="10" y1="140" x2="38" y2="140" stroke="#9333ea" strokeWidth="1.5" strokeLinecap="round" opacity="0.3"/>
      <line x1="4"  y1="154" x2="38" y2="154" stroke="#e91e8c" strokeWidth="1.2" strokeLinecap="round" opacity="0.22"/>

      {/* Dust */}
      <circle cx="18" cy="170" r="4" fill="#9333ea" opacity="0.3"/>
      <circle cx="8"  cy="163" r="3" fill="#e91e8c" opacity="0.25"/>
      <circle cx="28" cy="167" r="2.5" fill="#c026d3" opacity="0.2"/>

      {/* Music notes */}
      <text x="444" y="52" fontSize="26" fill="#e91e8c" opacity="0.9"  transform="rotate(-10 444 52)">♪</text>
      <text x="424" y="30" fontSize="18" fill="#c084fc" opacity="0.75" transform="rotate(6 424 30)">♫</text>
      <text x="462" y="74" fontSize="14" fill="#e91e8c" opacity="0.6"  transform="rotate(-4 462 74)">♩</text>
      <text x="410" y="14" fontSize="12" fill="#f0abfc" opacity="0.5"  transform="rotate(12 410 14)">♬</text>

      {/* Stars */}
      <circle cx="20" cy="32" r="2.5" fill="#e91e8c" opacity="0.6"/>
      <circle cx="10" cy="52" r="1.8" fill="#c084fc" opacity="0.5"/>
      <circle cx="30" cy="20" r="2"   fill="#f0abfc" opacity="0.45"/>
    </svg>
  );
}

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

// ─── Splash Screen ────────────────────────────────────────────────────────────

function SplashScreen({ onChoose }) {
  return (
    <div className="splash">
      <div className="splash-inner">
        <img src={concertImg} alt="ג׳ימבו ג׳יי קיסריה 13.5" className="splash-img" />
        <div className="splash-content">
          <h2 className="splash-title">🚗 לוח טרמפים</h2>
          <p className="splash-sub">ג׳ימבו ג׳יי ולהקת ספא • קיסריה 13.5</p>
          <div className="splash-btns">
            <button
              className="splash-btn splash-btn-offer"
              onClick={() => onChoose('offering')}
            >
              🚗 יש לי מקום באוטו
            </button>
            <button
              className="splash-btn splash-btn-seek"
              onClick={() => onChoose('seeking')}
            >
              ✋ מחפש/ת טרמפ
            </button>
          </div>
          <button
            className="splash-browse"
            onClick={() => onChoose(null)}
          >
            קח אותי ללוח
          </button>
          <div className="splash-bus-scene">
            <div className="splash-van-track">
              <BusSvg className="splash-van" />
            </div>
            <div className="splash-road">
              <div className="splash-road-dashes" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Type Picker Sheet ────────────────────────────────────────────────────────

function TypePickerSheet({ onPick, onClose }) {
  const overlayRef = useRef();
  return (
    <div
      className="sheet-overlay"
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div className="sheet">
        <div className="sheet-handle" />
        <p className="sheet-title">מה תרצה/י לפרסם?</p>
        <div className="sheet-btns">
          <button className="sheet-btn sheet-btn-offer" onClick={() => onPick('offering')}>
            <span className="sheet-btn-icon">🚗</span>
            <span className="sheet-btn-label">יש לי מקום באוטו</span>
            <span className="sheet-btn-sub">אני נוסע/ת ויש לי מקום</span>
          </button>
          <button className="sheet-btn sheet-btn-seek" onClick={() => onPick('seeking')}>
            <span className="sheet-btn-icon">✋</span>
            <span className="sheet-btn-label">מחפש/ת טרמפ</span>
            <span className="sheet-btn-sub">אני צריך/ה הסעה</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Post Form ────────────────────────────────────────────────────────────────

const DEPARTURE_TIMES = [
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
  '21:00', '22:00 (אחרי ההופעה)', '23:00 (אחרי ההופעה)', '00:00 (אחרי ההופעה)',
];

const SORTED_CITIES = [...CITIES].sort((a, b) => a.name.localeCompare(b.name, 'he'));

// ─── City Picker (searchable) ──────────────────────────────────────────────

function CityPicker({ value, onChange, hasError }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef();

  const trimmed = query.trim();
  const filtered = trimmed
    ? SORTED_CITIES.filter((c) => c.name.includes(trimmed))
    : SORTED_CITIES;

  // Show manual option when user typed something not exactly in the list
  const showManual = trimmed.length > 0 && !SORTED_CITIES.some((c) => c.name === trimmed);

  const select = (name) => {
    onChange(name);
    setQuery('');
    setOpen(false);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="city-picker" ref={containerRef}>
      <div
        className={`city-input-wrap ${hasError ? 'field-error' : ''}`}
        onClick={() => { setOpen(true); }}
      >
        <span className="city-search-icon">🔍</span>
        <input
          className="city-input"
          type="text"
          placeholder={value || 'חפש/י עיר או יישוב...'}
          value={open ? query : (value || '')}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
          inputMode="search"
        />
        {value && !open && (
          <button
            type="button"
            className="city-clear"
            onClick={(e) => { e.stopPropagation(); onChange(''); setQuery(''); }}
          >×</button>
        )}
      </div>
      {open && (
        <div className="city-dropdown">
          {filtered.map((c) => (
            <button
              key={c.name}
              type="button"
              className={`city-option ${value === c.name ? 'city-option-selected' : ''}`}
              onClick={() => select(c.name)}
            >
              {value === c.name && <span className="city-check">✓</span>}
              {c.name}
            </button>
          ))}
          {showManual && (
            <button
              type="button"
              className="city-option city-option-manual"
              onClick={() => select(trimmed)}
            >
              ✏️ הוסף ידנית: <strong>{trimmed}</strong>
            </button>
          )}
          {filtered.length === 0 && !showManual && (
            <div className="city-none">לא נמצאה עיר</div>
          )}
        </div>
      )}
    </div>
  );
}

function PostModal({ onClose, onSubmit, loading, initialType = 'offering', editPost = null }) {
  const isEdit = !!editPost;
  const [type, setType] = useState(editPost?.type ?? initialType);
  const [from, setFrom] = useState(editPost?.from ?? '');
  const [direction, setDirection] = useState(editPost?.direction ?? 'going');
  const [departureTime, setDepartureTime] = useState(editPost?.departureTime ?? '');
  const [seats, setSeats] = useState(editPost?.seats ?? 2);
  const [passengers, setPassengers] = useState(editPost?.passengers ?? 1);
  const [costType, setCostType] = useState(editPost?.costType ?? '');
  const [contactType, setContactType] = useState(editPost?.contactType ?? 'whatsapp');
  const [contact, setContact] = useState(editPost?.contact ?? '');
  const [name, setName] = useState(editPost?.name ?? '');
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
          <h2 className="modal-title">{isEdit ? '✏️ ערוך מודעה' : '🎵 פרסם מודעה'}</h2>
          <button className="modal-x" onClick={onClose}>×</button>
        </div>

        {/* Type toggle — only in edit mode; new posts use TypePickerSheet */}
        {isEdit && (
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
        )}

        <form onSubmit={handleSubmit} className="form" noValidate>

          {/* City */}
          <div className="field">
            <label className="field-label">📍 מאיפה יוצאים?</label>
            <CityPicker
              value={from}
              onChange={setFrom}
              hasError={!!errors.from}
            />
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

          {/* Time — drivers only */}
          {type === 'offering' && (
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
          )}

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
            {loading ? '⏳ שומר...' : isEdit ? '✅ שמור שינויים' : '🎵 פרסם מודעה'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Pin Success Modal ─────────────────────────────────────────────────────────

function PinSuccessModal({ pin, onClose }) {
  const [copied, setCopied] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const digits = pin.split('');
  const cardRef = useRef();

  const handleCopy = () => {
    navigator.clipboard?.writeText(pin).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleScreenshot = async () => {
    if (!cardRef.current || capturing) return;
    setCapturing(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#130020',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      canvas.toBlob(async (blob) => {
        const file = new File([blob], `jimbo-pin-${pin}.png`, { type: 'image/png' });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'הקוד שלי — לוח טרמפים ג׳ימבו' });
        } else {
          // fallback: download
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = file.name; a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      }, 'image/png');
    } catch (e) {
      console.error(e);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="modal-overlay pin-overlay">
      <div className="modal pin-success-modal" ref={cardRef}>
        <div className="pin-success-top">
          <span className="pin-success-icon">✅</span>
          <h2 className="pin-success-title">המודעה פורסמה!</h2>
        </div>

        <p className="pin-success-sub">זה הקוד האישי שלך:</p>

        <div className="pin-digits-row" dir="ltr">
          {digits.map((d, i) => (
            <div key={i} className="pin-digit">{d}</div>
          ))}
        </div>

        <button className="pin-copy-btn" onClick={handleCopy}>
          {copied ? '✓ הועתק!' : '📋 העתק קוד'}
        </button>

        <div className="pin-warning-box">
          <p className="pin-warning-text">
            🔐 שמור/י את הקוד הזה!<br />
            הוא הדרך היחידה לערוך או למחוק את המודעה שלך מכל מכשיר.
            הקוד גלוי רק לך.
          </p>
        </div>

        <button
          className="pin-screenshot-btn"
          onClick={handleScreenshot}
          disabled={capturing}
        >
          {capturing ? '⏳ מצלם...' : '📷 הכי טוב ללחוץ פה לצלם מסך :)'}
        </button>

        <button className="submit-btn pin-done-btn" onClick={onClose}>
          שמרתי את הקוד — המשך ✓
        </button>
      </div>
    </div>
  );
}

// ─── My Ads Modal ─────────────────────────────────────────────────────────────

function MyAdCard({ post, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isOffering = post.type === 'offering';

  const dirLabel = { going: '→ הלוך', return: '← חזרה', both: '↔ הלוך ושוב' }[post.direction] || '';

  return (
    <div className={`my-ad-card ${isOffering ? 'my-ad-offer' : 'my-ad-seek'}`}>
      <div className="my-ad-top">
        <span className={`type-badge ${isOffering ? 'badge-offer' : 'badge-seek'}`}>
          {isOffering ? '🚗 מסיע' : '✋ מחפש טרמפ'}
        </span>
        <span className="my-ad-dir">{dirLabel}</span>
      </div>

      <div className="my-ad-from">
        <span className="city-pin">📍</span>
        <strong>{post.from}</strong>
      </div>

      <div className="chips-row" style={{ marginBottom: 0 }}>
        {post.departureTime && <span className="chip">🕐 {post.departureTime}</span>}
        {isOffering
          ? <span className="chip">💺 {post.seats} מקומות</span>
          : <span className="chip">👥 {post.passengers} {post.passengers === 1 ? 'איש' : 'אנשים'}</span>}
        {isOffering && post.costType && (
          <span className={`chip ${post.costType === 'free' ? 'chip-free' : 'chip-fuel'}`}>
            {post.costType === 'free' ? '🎁 חינם' : '⛽ דלק'}
          </span>
        )}
      </div>

      <div className="my-ad-actions">
        {confirmDelete ? (
          <div className="my-ad-confirm">
            <span>בטוח למחוק?</span>
            <button className="my-ad-btn my-ad-btn-danger" onClick={onDelete}>כן, מחק</button>
            <button className="my-ad-btn my-ad-btn-ghost" onClick={() => setConfirmDelete(false)}>ביטול</button>
          </div>
        ) : (
          <>
            <button className="my-ad-btn my-ad-btn-edit" onClick={onEdit}>✏️ ערוך</button>
            <button className="my-ad-btn my-ad-btn-danger" onClick={() => setConfirmDelete(true)}>🗑️ מחק</button>
          </>
        )}
      </div>
    </div>
  );
}

function MyAdsModal({ posts, onClose, onDelete, onUpdate, updateLoading }) {
  const [editingPost, setEditingPost] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [activePin, setActivePin] = useState(getSavedPin()); // auto-fill if saved
  const [pinError, setPinError] = useState('');
  const overlayRef = useRef();

  const myPosts = posts.filter((p) => p.userPin === activePin);

  const handlePinSubmit = (e) => {
    e.preventDefault();
    const trimmed = pinInput.trim();
    if (trimmed.length !== 4) return;
    const found = posts.some((p) => p.userPin === trimmed);
    if (found) {
      savePin(trimmed);
      setActivePin(trimmed);
      setPinError('');
    } else {
      setPinError('לא נמצאו מודעות עם קוד זה');
    }
  };

  if (editingPost) {
    return (
      <PostModal
        editPost={editingPost}
        onClose={() => setEditingPost(null)}
        onSubmit={async (form) => {
          await onUpdate(editingPost.id, form);
          setEditingPost(null);
        }}
        loading={updateLoading}
        initialType={editingPost.type}
      />
    );
  }

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">👤 המודעות שלי</h2>
          <button className="modal-x" onClick={onClose}>×</button>
        </div>

        {!activePin ? (
          /* ── PIN entry gate ── */
          <form className="pin-entry-form" onSubmit={handlePinSubmit} noValidate>
            <p className="pin-entry-desc">
              הכנס/י את הקוד האישי שלך (4 ספרות)<br />
              כדי לראות ולנהל את המודעות שלך
            </p>
            <input
              className={`pin-input ${pinError ? 'field-error' : ''}`}
              type="text"
              inputMode="numeric"
              dir="ltr"
              placeholder="_ _ _ _"
              maxLength={4}
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                setPinError('');
              }}
              autoFocus
            />
            {pinError && <span className="err">{pinError}</span>}
            <button type="submit" className="submit-btn" disabled={pinInput.length !== 4}>
              כניסה ←
            </button>
            <p className="pin-entry-hint">
              עדיין אין לך קוד? פרסם מודעה ותקבל אחד אוטומטית.
            </p>
          </form>
        ) : myPosts.length === 0 ? (
          <div className="my-ads-empty">
            <p className="my-ads-empty-icon">📭</p>
            <p className="my-ads-empty-title">אין לך מודעות עדיין</p>
            <p className="my-ads-empty-sub">פרסם מודעה ותוכל לנהל אותה כאן</p>
          </div>
        ) : (
          <div className="my-ads-list">
            {myPosts.map((post) => (
              <MyAdCard
                key={post.id}
                post={post}
                onEdit={() => setEditingPost(post)}
                onDelete={() => onDelete(post.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [posts, setPosts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [modalInitialType, setModalInitialType] = useState('offering');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showMyAds, setShowMyAds] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [newPostPin, setNewPostPin] = useState(null); // PIN to reveal after first post
  const [notifications, setNotifications] = useState([]);
  const [dbError, setDbError] = useState(false);
  const prevIdsRef = useRef(null);

  const handleTypePick = (type) => {
    setShowTypePicker(false);
    setModalInitialType(type);
    setShowModal(true);
  };

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
      let pin = getSavedPin();
      const isNewPin = !pin;
      if (isNewPin) {
        pin = generateUniquePin(posts);
        savePin(pin);
      }
      await addDoc(collection(db, 'rides'), {
        ...form,
        userPin: pin,
        createdAt: serverTimestamp(),
      });
      setShowModal(false);
      setNewPostPin(pin); // always show PIN after posting
    } catch (err) {
      console.error(err);
      alert('שגיאה בשמירה — בדוק חיבור ונסה שוב.');
    } finally {
      setLoading(false);
    }
  }, [posts]);

  const handleUpdate = useCallback(async (id, form) => {
    setUpdateLoading(true);
    try {
      await updateDoc(doc(db, 'rides', id), { ...form });
    } catch (err) {
      console.error(err);
      alert('שגיאה בעדכון — נסה שוב.');
    } finally {
      setUpdateLoading(false);
    }
  }, []);

  const handleDelete = useCallback(async (id) => {
    try {
      await deleteDoc(doc(db, 'rides', id));
    } catch (err) {
      console.error(err);
      alert('שגיאה במחיקה — נסה שוב.');
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
        <div className="header-img-wrap">
          <img src={concertImg} alt="ג׳ימבו ג׳יי קיסריה 13.5" className="header-concert-img" />
          <div className="header-img-overlay">
            <div className="header-badge">🚗 לוח טרמפים</div>
            <button className="my-ads-btn" onClick={() => setShowMyAds(true)}>
              👤 <span className="my-ads-btn-text">המודעות שלי</span>
            </button>
          </div>
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
            <BusSvg className="empty-van" />
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
      <button className="fab" onClick={() => setShowTypePicker(true)} aria-label="פרסם מודעה">
        <span className="fab-plus">+</span> פרסם מודעה
      </button>

      {showModal && (
        <PostModal
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          loading={loading}
          initialType={modalInitialType}
        />
      )}

      {showMyAds && (
        <MyAdsModal
          posts={posts}
          onClose={() => setShowMyAds(false)}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          updateLoading={updateLoading}
        />
      )}

      {showTypePicker && (
        <TypePickerSheet onPick={handleTypePick} onClose={() => setShowTypePicker(false)} />
      )}

      {newPostPin && (
        <PinSuccessModal pin={newPostPin} onClose={() => setNewPostPin(null)} />
      )}
    </div>
  );
}
