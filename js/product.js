/* ============================================
   PRODUCT PAGE JS — product.js
   Handles sticky bar show/hide on scroll
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  const stickyBar = document.getElementById('stickyBar');
  const hero = document.querySelector('.product-hero');

  if (!stickyBar || !hero) return;

  const showAfter = hero.offsetHeight - 100;

  const onScroll = () => {
    if (window.scrollY > showAfter) {
      stickyBar.classList.add('visible');
    } else {
      stickyBar.classList.remove('visible');
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const masteryInstalmentUrl = 'https://buy.stripe.com/cNi8wP53m5o69Wt7MoeEo0o';
  document.querySelectorAll('[data-mastery-instalment-link]').forEach((link) => {
    link.href = masteryInstalmentUrl;
  });
});
