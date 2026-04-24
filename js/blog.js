/* ============================================
   BLOG FILTER — blog.js
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  // Promote the first blog-card to the featured slot automatically.
  // To feature a new post, just add it as the first .blog-card in the grid.
  const firstCard = document.querySelector('.blog-card');
  const featured  = document.querySelector('.featured-card');

  if (firstCard && featured) {
    const img      = firstCard.querySelector('img');
    const tagEl    = firstCard.querySelector('.blog-tag');
    const dateEl   = firstCard.querySelector('.blog-card__date');
    const titleEl  = firstCard.querySelector('.blog-card__title');
    const excerptEl = firstCard.querySelector('.blog-card__excerpt');

    featured.href = firstCard.href;
    const featImg = featured.querySelector('img');
    featImg.src   = img.src;
    featImg.alt   = img.alt;
    featImg.loading = 'eager';

    const featTag = featured.querySelector('.blog-tag');
    featTag.className = tagEl.className;
    featTag.textContent = tagEl.textContent;

    featured.querySelector('.featured-card__date').textContent  = dateEl.textContent;
    featured.querySelector('.featured-card__title').textContent = titleEl.textContent;
    featured.querySelector('.featured-card__excerpt').textContent = excerptEl.textContent;

    // Hide the first card from the grid to avoid duplication
    firstCard.style.display = 'none';
  }

  const filters = document.querySelectorAll('.blog-filter');
  const cards   = document.querySelectorAll('.blog-card');

  filters.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active state
      filters.forEach(f => {
        f.classList.remove('active');
        f.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');

      const filter = btn.dataset.filter;

      cards.forEach(card => {
        if (filter === 'all' || card.dataset.category === filter) {
          card.classList.remove('hidden');
          // Re-trigger reveal animation
          card.classList.remove('visible');
          requestAnimationFrame(() => {
            card.classList.add('visible');
          });
        } else {
          card.classList.add('hidden');
        }
      });
    });
  });
});
