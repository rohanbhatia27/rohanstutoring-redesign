/* ============================================
   BLOG FILTER — blog.js
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  const filters = document.querySelectorAll('.blog-filter');
  const cards   = document.querySelectorAll('.blog-card');

  filters.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active state
      filters.forEach(f => f.classList.remove('active'));
      btn.classList.add('active');

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
