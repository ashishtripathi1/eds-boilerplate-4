import { createOptimizedPicture } from '../../scripts/aem.js';

function parseTestimonial(row) {
  const [imageCell, textCell, ratingCell] = [...row.children];

  // Optimize author image
  const imgEl = imageCell?.querySelector('img');
  if (imgEl) {
    const oldPicture = imgEl.closest('picture');
    if (oldPicture) {
      oldPicture.replaceWith(
        createOptimizedPicture(imgEl.src, imgEl.alt || '', false, [{ width: '200' }]),
      );
    }
  }

  // Parse text: p[0]=quote, p[1]=Name | Title, p[2]=Company
  const paragraphs = [...(textCell?.querySelectorAll('p') || [])];
  const quoteEl = paragraphs[0] || null;

  let authorName = '';
  let authorTitle = '';
  const attrEl = paragraphs[1];
  if (attrEl) {
    const strong = attrEl.querySelector('strong');
    authorName = strong?.textContent.trim() || '';
    authorTitle = attrEl.textContent.replace(authorName, '').replace(/^\s*\|?\s*/, '').trim();
  }

  const company = paragraphs[2]?.textContent.trim() || '';

  // Rating: numeric 1–5 or count of ★ characters
  const ratingRaw = (ratingCell?.textContent || '').trim();
  let rating = parseInt(ratingRaw, 10);
  if (Number.isNaN(rating)) rating = (ratingRaw.match(/★/g) || []).length;
  rating = Math.min(Math.max(rating || 0, 0), 5);

  return {
    picture: imageCell?.querySelector('picture') || null,
    quoteEl,
    authorName,
    authorTitle,
    company,
    rating,
  };
}

function buildStars(rating) {
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 5; i += 1) {
    const star = document.createElement('span');
    star.className = `testimonial-carousel-star${i < rating ? ' filled' : ''}`;
    star.setAttribute('aria-hidden', 'true');
    star.textContent = '★';
    fragment.append(star);
  }
  return fragment;
}

function buildSlide({
  picture, quoteEl, authorName, authorTitle, company, rating,
}, index) {
  const slide = document.createElement('div');
  slide.className = 'testimonial-carousel-slide';
  slide.setAttribute('role', 'tabpanel');
  slide.setAttribute('aria-label', `Testimonial ${index + 1}`);
  if (index !== 0) slide.setAttribute('aria-hidden', 'true');

  const content = document.createElement('div');
  content.className = 'testimonial-carousel-content';

  // ── Text column ──────────────────────────────────────
  const textDiv = document.createElement('div');
  textDiv.className = 'testimonial-carousel-text';

  if (quoteEl) {
    const blockquote = document.createElement('blockquote');
    blockquote.className = 'testimonial-carousel-quote';
    while (quoteEl.firstChild) blockquote.append(quoteEl.firstChild);
    textDiv.append(blockquote);
  }

  const attribution = document.createElement('div');
  attribution.className = 'testimonial-carousel-attribution';

  if (authorName) {
    const authorP = document.createElement('p');
    authorP.className = 'testimonial-carousel-author';
    const nameStrong = document.createElement('strong');
    nameStrong.textContent = authorName;
    authorP.append(nameStrong);
    if (authorTitle) {
      const sep = document.createElement('span');
      sep.className = 'testimonial-carousel-separator';
      sep.setAttribute('aria-hidden', 'true');
      sep.textContent = ' | ';
      const titleSpan = document.createElement('span');
      titleSpan.textContent = authorTitle;
      authorP.append(sep, titleSpan);
    }
    attribution.append(authorP);
  }

  if (company) {
    const companyP = document.createElement('p');
    companyP.className = 'testimonial-carousel-company';
    companyP.textContent = company;
    attribution.append(companyP);
  }

  if (rating > 0) {
    const ratingP = document.createElement('p');
    ratingP.className = 'testimonial-carousel-rating';
    ratingP.setAttribute('aria-label', `${rating} out of 5 stars`);
    ratingP.append(buildStars(rating));
    attribution.append(ratingP);
  }

  textDiv.append(attribution);
  content.append(textDiv);

  // ── Image column ─────────────────────────────────────
  const imageDiv = document.createElement('div');
  imageDiv.className = 'testimonial-carousel-image';
  if (picture) imageDiv.append(picture);
  content.append(imageDiv);

  slide.append(content);
  return slide;
}

export default function decorate(block) {
  const rows = [...block.children];
  if (!rows.length) return;

  const testimonials = rows.map(parseTestimonial);
  const total = testimonials.length;

  // ── Track ─────────────────────────────────────────────
  const track = document.createElement('div');
  track.className = 'testimonial-carousel-track';

  const slides = testimonials.map((data, i) => {
    const slide = buildSlide(data, i);
    if (i === 0) slide.classList.add('active');
    track.append(slide);
    return slide;
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'testimonial-carousel-viewport';
  wrapper.append(track);

  // ── Navigation (prev / next) ──────────────────────────
  const prevBtn = document.createElement('button');
  prevBtn.className = 'testimonial-carousel-nav testimonial-carousel-prev';
  prevBtn.setAttribute('aria-label', 'Previous testimonial');
  prevBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>';

  const nextBtn = document.createElement('button');
  nextBtn.className = 'testimonial-carousel-nav testimonial-carousel-next';
  nextBtn.setAttribute('aria-label', 'Next testimonial');
  nextBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>';

  // ── Dots ──────────────────────────────────────────────
  const dotsNav = document.createElement('nav');
  dotsNav.className = 'testimonial-carousel-dots';
  dotsNav.setAttribute('aria-label', 'Testimonial navigation');

  const dots = slides.map((_, i) => {
    const dot = document.createElement('button');
    dot.setAttribute('aria-label', `Go to testimonial ${i + 1}`);
    if (i === 0) dot.classList.add('active');
    dot.setAttribute('aria-current', i === 0 ? 'true' : 'false');
    dotsNav.append(dot);
    return dot;
  });

  // ── State ─────────────────────────────────────────────
  let current = 0;

  function syncDots(index) {
    dots[current].classList.remove('active');
    dots[current].setAttribute('aria-current', 'false');
    slides[current].setAttribute('aria-hidden', 'true');
    slides[current].classList.remove('active');

    current = index;

    dots[current].classList.add('active');
    dots[current].setAttribute('aria-current', 'true');
    slides[current].removeAttribute('aria-hidden');
    slides[current].classList.add('active');
  }

  function goTo(index) {
    const next = ((index % total) + total) % total;
    if (next === current) return;
    syncDots(next);
    // scrollTo clips adjacent slides natively — no CSS transform hack needed
    wrapper.scrollTo({ left: next * wrapper.offsetWidth, behavior: 'smooth' });
  }

  prevBtn.addEventListener('click', () => goTo(current - 1));
  nextBtn.addEventListener('click', () => goTo(current + 1));
  dots.forEach((dot, i) => dot.addEventListener('click', () => goTo(i)));

  // Keyboard
  block.setAttribute('tabindex', '0');
  block.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') goTo(current - 1);
    if (e.key === 'ArrowRight') goTo(current + 1);
  });

  // Sync dots after native swipe / scroll-snap settles
  let scrollTimer;
  wrapper.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const snapped = Math.round(wrapper.scrollLeft / wrapper.offsetWidth);
      if (snapped !== current) syncDots(snapped);
    }, 120);
  }, { passive: true });

  // Autoplay — pauses on hover / focus
  if (total > 1) {
    let timer = setInterval(() => goTo(current + 1), 6000);
    const pause = () => clearInterval(timer);
    const resume = () => { timer = setInterval(() => goTo(current + 1), 6000); };
    block.addEventListener('mouseenter', pause);
    block.addEventListener('mouseleave', resume);
    block.addEventListener('focusin', pause);
    block.addEventListener('focusout', resume);
  }

  // Hide nav when only one slide
  if (total < 2) {
    prevBtn.hidden = true;
    nextBtn.hidden = true;
    dotsNav.hidden = true;
  }

  block.replaceChildren(prevBtn, wrapper, nextBtn, dotsNav);
}
