import { useEffect, useRef } from 'react';
import { FiCheckCircle } from 'react-icons/fi';
import { FaGraduationCap } from 'react-icons/fa';
import './Eduvhibe.css';
import useHorizontalAutoScroll from '../../hooks/useHorizontalAutoScroll';

const EDUVHIBE_ASSET_BASE = `${import.meta.env.BASE_URL}eduvhibe/`;
const mainHeroImage = `${EDUVHIBE_ASSET_BASE}main-img.jpg`;
const myProfileImage = `${EDUVHIBE_ASSET_BASE}chris.jpg`;
const originalCreatorImage = `${EDUVHIBE_ASSET_BASE}baffoe-theophilus.jpg`;
const michaelTestimonialImage = `${EDUVHIBE_ASSET_BASE}michael.jpg`;
const kwabenaTestimonialImage = `${EDUVHIBE_ASSET_BASE}kwabena-boateng.jpg`;
const amoahTestimonialImage = `${EDUVHIBE_ASSET_BASE}amoah-portia.jpg`;
const elijahTestimonialImage = `${EDUVHIBE_ASSET_BASE}eli.jpg`;
const keziahTestimonialImage = `${EDUVHIBE_ASSET_BASE}k.jpg`;
const enockTestimonialImage = `${EDUVHIBE_ASSET_BASE}tt.jpg`;

const testimonialsData = [
  {
    id: 1,
    name: 'Kwabena Boateng Agyei',
    role: 'Software Developer & Founder',
    quote:
      'As the founder of Learnda and a partner on Eduvhibe, I see it as a credible, reliable, and genuinely useful space for studying course materials.',
    image: kwabenaTestimonialImage,
  },
  {
    id: 2,
    name: 'Elijah Nyame',
    role: 'Colleague',
    quote:
      'As a colleague to the owner of Eduvhibe, I give credit to the platform. It has features that can help improve users educational progress.',
    image: elijahTestimonialImage,
  },
  {
    id: 3,
    name: 'Keziah Buabeng',
    role: 'Partner',
    quote:
      'Eduvhibe is usable, learner-friendly, and helpful for college students under UCC institutions. Use Eduvhibe to enrich educational progress.',
    image: keziahTestimonialImage,
  },
  {
    id: 4,
    name: 'Awuah Enock',
    role: 'Contributor',
    quote:
      'Eduvhibe is reliable and can help improve academics through useful materials and schedule-planning support.',
    image: enockTestimonialImage,
  },
  {
    id: 5,
    name: 'Acquah Michael',
    role: 'Colleague',
    quote:
      'I have seen the work behind Eduvhibe closely, and the platform has the right features to support stronger academic progress for students.',
    image: michaelTestimonialImage,
  },
  {
    id: 6,
    name: 'Amoah Portia',
    role: 'Student',
    quote:
      'The CGPA tracker alone saved me so much stress this semester. Having all my course materials organized in one clean dashboard is exactly what we needed on campus.',
    image: amoahTestimonialImage,
  },
  {
    id: 7,
    name: 'Baffoe Theophilus',
    role: 'Eduvhibe Founder',
    quote:
      'Eduvhibe started as a virtual learning site built to make course materials, academic videos, CGPA tracking, and study support easier for students.',
    image: originalCreatorImage,
  },
];

const ABOUT_HIGHLIGHTS = [
  'Download and view course materials uploaded for different departments and levels.',
  'Open academic video resources that support exam and revision prep.',
  'Explore practical study strategies and campus survival guidance.',
  'Track your CGPA throughout your educational journey with less stress.',
];

export default function AboutTab() {
  const heroRef = useRef(null);
  const carouselSectionRef = useRef(null);
  const carouselTrackRef = useRef(null);
  const profileRef = useRef(null);

  const { activeIndex: currentSlide, scrollToIndex } = useHorizontalAutoScroll(carouselTrackRef, {
    enabled: testimonialsData.length > 1,
    interval: 8500,
    pauseOnInteractionMs: 6500,
  });

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('show-on-scroll');
        }
      });
    });

    const elementsToWatch = [heroRef.current, carouselSectionRef.current, profileRef.current];
    elementsToWatch.forEach((element) => {
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  const handleImageError = (event, fallbackUrl) => {
    event.target.onerror = null;
    event.target.src = fallbackUrl;
  };

  return (
    <div className="about-container eduvhibe-about-tab">
      <div ref={heroRef} className="about-hero hidden-on-scroll">
        <div className="about-text-content">
          <div className="eduvhibe-about-brand">
            <div className="eduvhibe-about-brand-stack">
              <div className="eduvhibe-about-wordmark" aria-label="Eduvhibe">
                <FaGraduationCap />
                <span>Eduvhibe</span>
              </div>
              <span className="eduvhibe-cgpa-kicker">Empowering Education, Connecting Minds</span>
            </div>
          </div>
          <p className="about-description">
            Eduvhibe gives students access to a wide range of course materials and academic tools that enrich progress.
            It now lives inside Learnda so notes, videos, survival guides, CGPA tracking, and study support can work
            together in one learning platform.
          </p>

          <div className="eduvhibe-about-badges" aria-label="Eduvhibe highlights">
            <span>Notes and PDFs</span>
            <span>Academic videos</span>
            <span>CGPA planner</span>
          </div>

          <ul className="about-features-list">
            {ABOUT_HIGHLIGHTS.map((feature) => (
              <li key={feature}>
                <span className="about-feature-icon"><FiCheckCircle /></span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="about-image-content">
          <img
            src={mainHeroImage}
            alt="Eduvhibe study workspace"
            className="about-main-image"
            onError={(event) => handleImageError(event, 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&fit=crop')}
          />
        </div>
      </div>

      <div ref={carouselSectionRef} className="testimonials-section eduvhibe-testimonials-section hidden-on-scroll">
        <h3 className="eduvhibe-about-section-title">Voices from the Eduvhibe community</h3>

        <div className="testimonials-layout">
          <div className="community-image-side">
            <img
              src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1200&auto=format&fit=crop"
              alt="Students collaborating"
              className="community-banner-img"
            />
          </div>

          <div className="carousel-container">
            <div
              ref={carouselTrackRef}
              className="carousel-track"
              role="region"
              aria-label="Eduvhibe testimonials"
            >
              {testimonialsData.map((testimonial) => (
                <div className="carousel-slide" key={testimonial.id}>
                  <div className="testimonial-card">
                    <div className="testimonial-header">
                      <img src={testimonial.image} alt={testimonial.name} className="testimonial-avatar-img" />
                      <div>
                        <h4 className="testimonial-name">{testimonial.name}</h4>
                        <p className="testimonial-role">{testimonial.role}</p>
                      </div>
                    </div>
                    <p className="testimonial-quote">"{testimonial.quote}"</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="carousel-dots">
              {testimonialsData.map((_, index) => (
                <button
                  type="button"
                  key={index}
                  className={`dot ${currentSlide === index ? 'active-dot' : ''}`}
                  onClick={() => scrollToIndex(index)}
                  aria-label={`Show testimonial ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="edu-about-section eduvhibe-about-profile-section">
        <h3 className="eduvhibe-about-profile-title">Platform Builders</h3>

        <div ref={profileRef} className="eduvhibe-profile-stack hidden-on-scroll">
          <div className="edu-profile-card eduvhibe-profile-card">
            <div className="profile-header">
              <img
                src={myProfileImage}
                alt="Osei Chris"
                className="profile-avatar-img"
                onError={(event) => handleImageError(event, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&fit=crop')}
              />
              <div>
                <h2 className="profile-name">Osei Chris</h2>
                <p className="profile-title">Frontend/Backend Developer & Tech Entrepreneur</p>
              </div>
            </div>

            <div className="profile-body">
              <p>Hello. I am Osei Chris, a college student with a deep interest in software engineering, mathematics, and building digital products.</p>
              <p>I built this Eduvhibe V3 interface to merge clean, modern design with practical tools that help students succeed.</p>
            </div>
          </div>

          <div className="edu-profile-card eduvhibe-profile-card eduvhibe-founder-card">
            <div className="profile-header">
              <img
                src={originalCreatorImage}
                alt="Baffoe Theophilus"
                className="profile-avatar-img"
                onError={(event) => handleImageError(event, mainHeroImage)}
              />
              <div>
                <h2 className="profile-name">Baffoe Theophilus</h2>
                <p className="profile-title">Original Eduvhibe Creator</p>
              </div>
            </div>

            <div className="profile-body">
              <p>Baffoe Theophilus conceived the Eduvhibe idea, built Eduvhibe V1 and V2, and shaped it around course materials, video resources, survival guides, and CGPA tracking.</p>
              <p>He offered Eduvhibe to Learnda because most of its operations were cross-cutting with Learnda's learning mission. The integration keeps the original academic purpose while giving students a stronger platform around it.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
