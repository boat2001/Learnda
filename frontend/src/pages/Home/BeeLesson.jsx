import './BeeLesson.css';

export default function BeeLesson() {
  return (
    <div className="bee-lesson">
      <svg data-bee-scene viewBox="0 0 480 390" preserveAspectRatio="none" role="img" aria-labelledby="bee-lesson-title bee-lesson-desc">
        <title id="bee-lesson-title">Your friendly learning bee</title>
        <desc id="bee-lesson-desc">A smiling bee says Akwaaba! Welcome! With colourful wings, it teaches that two halves make one whole, beside an open book.</desc>
        <circle cx="245" cy="192" r="168" fill="var(--tint-amber)" />
        <g className="bee-lesson__speech" transform="rotate(-4 119 340)">
          <path d="M63 307h63q13-5 23-20-1 13-5 20h31q28 0 28 28v10q0 28-28 28H63q-28 0-28-28v-10q0-28 28-28Z" fill="var(--brand-navy)" opacity=".1" transform="translate(0 5)" />
          <path d="M63 307h63q13-5 23-20-1 13-5 20h31q28 0 28 28v10q0 28-28 28H63q-28 0-28-28v-10q0-28 28-28Z" fill="var(--surface)" stroke="var(--brand-amber)" strokeWidth="3" strokeLinejoin="round" />
          <path d="M52 329q1-12 14-12h21" fill="none" stroke="var(--tint-amber)" strokeWidth="5" strokeLinecap="round" />
          <text x="119" y="350" textAnchor="middle" fill="var(--brand-navy)" fontSize="26" fontWeight="800">Akwaaba!</text>
        </g>
        <path d="M42 243 Q5 154 73 120 Q135 91 128 48" className="bee-lesson__trail" />
        <g className="bee-lesson__sparkles" fill="var(--brand-orange)">
          <path d="m72 74 4 11 11 4-11 4-4 11-4-11-11-4 11-4Z" />
          <path d="m413 254 3 9 9 3-9 3-3 9-3-9-9-3 9-3Z" />
          <circle cx="398" cy="76" r="5" fill="var(--brand-blue)" />
        </g>
        <g transform="rotate(3 325 162)">
          <rect x="229" y="77" width="216" height="177" rx="20" fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="3" />
          <rect x="241" y="89" width="192" height="153" rx="12" fill="var(--brand-navy)" />
          <text x="337" y="119" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="700">Let's learn fractions!</text>
          <circle cx="286" cy="159" r="22" fill="none" stroke="#ffffff80" strokeWidth="2" />
          <path d="M286 137 A22 22 0 0 0 286 181Z" fill="var(--brand-amber)" />
          <text x="322" y="166" fill="#fff" fontSize="23">+</text>
          <circle cx="367" cy="159" r="22" fill="none" stroke="#ffffff80" strokeWidth="2" />
          <path d="M367 137 A22 22 0 0 1 367 181Z" fill="var(--brand-orange)" />
          <text x="337" y="212" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="700">½ + ½ = 1</text>
          <path className="bee-lesson__underline" d="M288 223H386" stroke="var(--brand-green)" strokeWidth="4" strokeLinecap="round" />
        </g>
        <ellipse cx="169" cy="311" rx="74" ry="11" fill="var(--brand-navy)" opacity=".09" />
        <g className="bee-lesson__bee" stroke="var(--brand-navy)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <g className="bee-lesson__wing bee-lesson__wing--left">
            <ellipse cx="107" cy="175" rx="28" ry="46" transform="rotate(-38 107 175)" fill="var(--brand-orange)" />
            <ellipse cx="100" cy="211" rx="24" ry="32" transform="rotate(-62 100 211)" fill="var(--brand-green)" />
          </g>
          <g className="bee-lesson__wing bee-lesson__wing--right">
            <ellipse cx="194" cy="169" rx="28" ry="46" transform="rotate(38 194 169)" fill="var(--brand-amber)" />
            <ellipse cx="211" cy="204" rx="24" ry="32" transform="rotate(62 211 204)" fill="var(--brand-blue)" />
          </g>
          <path d="m141 276-9 17m35-17 9 17" fill="none" />
          <ellipse cx="153" cy="236" rx="43" ry="49" fill="var(--brand-amber)" />
          <path d="M113 227Q153 247 193 227M117 251Q153 271 188 251" fill="none" strokeWidth="13" />
          <path d="M136 144q-8-25-21-28m53 28q8-25 21-28" fill="none" />
          <circle cx="114" cy="115" r="5" fill="var(--brand-navy)" />
          <circle cx="190" cy="115" r="5" fill="var(--brand-navy)" />
          <ellipse cx="153" cy="175" rx="48" ry="42" fill="var(--brand-amber)" />
          <g className="bee-lesson__eyes" fill="var(--brand-navy)" stroke="none">
            <ellipse cx="137" cy="173" rx="5" ry="8" /><ellipse cx="170" cy="173" rx="5" ry="8" />
          </g>
          <circle cx="122" cy="187" r="7" fill="var(--brand-orange)" opacity=".5" stroke="none" />
          <circle cx="184" cy="187" r="7" fill="var(--brand-orange)" opacity=".5" stroke="none" />
          <path d="M141 189q12 13 24 0" fill="none" strokeWidth="3" />
          <g className="bee-lesson__pointer">
            <path d="M191 234q24 10 35-12" fill="none" />
            <path d="m225 227 46-64" fill="none" stroke="var(--ink-orange)" strokeWidth="5" />
            <circle cx="226" cy="224" r="7" fill="var(--brand-amber)" />
          </g>
          <path d="M114 235q-17 0-23-15" fill="none" />
        </g>
        <g stroke="var(--brand-navy)" strokeWidth="3" strokeLinejoin="round">
          <path d="M220 313q43-20 83 0 43-20 83 0v41q-43-17-83 0-40-17-83 0Z" fill="var(--brand-blue)" />
          <path d="M227 300q38-16 76 4 38-20 76-4v42q-38-14-76 4-38-18-76-4Z" fill="var(--surface)" />
          <path d="M303 304v42" fill="none" />
          <path d="m240 313 43 5m-43 7 43 5m35-12 43-5m-43 17 43-5" fill="none" stroke="var(--line-strong)" />
          <path d="M312 304v30l8-5 8 3v-32" fill="var(--brand-orange)" stroke="none" />
        </g>
      </svg>
    </div>
  );
}
