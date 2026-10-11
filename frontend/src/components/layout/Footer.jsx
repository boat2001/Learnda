// Site footer.
//
// Learning feedback, education resources, help, policies, and social links.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FaFacebookF, FaInstagram, FaTiktok, FaXTwitter, FaYoutube, FaWhatsapp } from "react-icons/fa6";
import { FiArrowUp, FiInfo, FiBookOpen, FiDownload, FiUsers, FiMail, FiAlertCircle, FiShield, FiSmile, FiFileText, FiGrid, FiHome } from "react-icons/fi";
import "./Footer.css";
import PlatformRating from './PlatformRating';

const LOGO_SRC = `${import.meta.env.BASE_URL}learnda-logo.webp`;

const LINK_GROUPS = [
  {
    title: "Learnda",
    links: [
      { to: "/about", label: "About Us", Icon: FiInfo },
      { to: "/user-manual", label: "User Guide", Icon: FiBookOpen },
      { to: "/download", label: "Get the App", Icon: FiDownload },
    ],
  },
  {
    title: "Academics",
    links: [
      { to: "/curriculums", label: "Curricula", Icon: FiGrid },
      { to: "/schools", label: "Schools", Icon: FiHome },
      { to: "/education-policies", label: "GES & MoE", Icon: FiFileText },
    ],
  },
  {
    title: "Support",
    links: [
      { to: "/partnerships", label: "Partnerships", Icon: FiUsers },
      { to: "/contact", label: "Contact Us", Icon: FiMail },
      { to: "/report", label: "Report an Issue", Icon: FiAlertCircle },
    ],
  },
  {
    title: "Policies",
    links: [
      { to: "/privacy", label: "Privacy", Icon: FiShield },
      { to: "/child-safety", label: "Child Safety", Icon: FiSmile },
      { to: "/terms", label: "Terms of Use", Icon: FiFileText },
    ],
  },
];

const SOCIALS = [
  { href: "https://www.facebook.com/learnda", label: "Facebook", Icon: FaFacebookF },
  { href: "https://whatsapp.com/channel/learnda", label: "WhatsApp", Icon: FaWhatsapp },
  { href: "https://www.youtube.com/@learnda", label: "YouTube", Icon: FaYoutube },
  { href: "https://tiktok.com/@learnda", label: "TikTok", Icon: FaTiktok },
  { href: "https://x.com/learnda", label: "X", Icon: FaXTwitter },
  { href: "https://instagram.com/learnda", label: "Instagram", Icon: FaInstagram },
];

export default function Footer() {
  const [showBackToTop, setShowBackToTop] = useState(false);
  const footerRef = useRef(null);
  const [dashRows, setDashRows] = useState({});

  useEffect(() => {
    const footer = footerRef.current;
    const brand = footer.querySelector('.footer__brand');
    const nav = footer.querySelector('.footer__links');
    const measure = () => {
      const next = {};
      if (window.matchMedia('(min-width: 1101px)').matches) {
        const bottom = brand.getBoundingClientRect().bottom;
        nav.querySelectorAll('.footer__group').forEach(group => {
          const list = group.querySelector('ul');
          const rows = list.querySelectorAll('li:not(.footer__dash)');
          const last = rows[rows.length - 1].getBoundingClientRect();
          const gap = parseFloat(getComputedStyle(list).rowGap) || 0;
          next[group.dataset.group] = Math.max(0, Math.round((bottom - last.bottom) / (last.height + gap)));
        });
      }
      setDashRows(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(brand);
    observer.observe(nav);
    window.addEventListener('resize', measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  useEffect(() => {
    const update = () => setShowBackToTop(window.scrollY > 600);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <>
      <footer className="footer" ref={footerRef}>
        <div className="footer__inner">
          <div className="footer__brand">
            <Link to="/" className="footer__logo" aria-label="Learnda home">
              <img src={LOGO_SRC} alt="" width="48" height="48" />
              <span className="footer__brand-copy">
                <span className="footer__brand-name">Learnda</span>
                <span className="footer__tagline">One class at a time.</span>
              </span>
            </Link>
            <PlatformRating />
          </div>

          <nav className="footer__links" aria-label="Footer">
            {LINK_GROUPS.map((group) => (
              <div key={group.title} className="footer__group" data-group={group.title}>
                <h2 className="footer__group-title">{group.title}</h2>
                <ul>
                  {group.links.map((link) => (
                    <li key={link.to}><Link to={link.to}><link.Icon aria-hidden="true" />{link.label}</Link></li>
                  ))}
                  {Array.from({ length: dashRows[group.title] || 0 }, (_, index) => <li className="footer__dash" key={`dash-${index}`} aria-hidden="true">—</li>)}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="footer__bottom">
          <p className="footer__legal">
          &copy; {new Date().getFullYear()} Learnda. Made in Ghana for Ghanaian learners.
          </p>
          <ul className="footer__socials" aria-label="Learnda on social media">
            {SOCIALS.map(({ href, label, Icon }) => (
              <li key={label}>
                <a href={href} aria-label={label} target="_blank" rel="noopener noreferrer"><Icon aria-hidden="true" /></a>
              </li>
            ))}
          </ul>
        </div>
      </footer>

      <button
        className={`back-to-top ${showBackToTop ? "visible" : ""}`}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
        type="button"
      >
        <FiArrowUp aria-hidden="true" />
      </button>
    </>
  );
}
