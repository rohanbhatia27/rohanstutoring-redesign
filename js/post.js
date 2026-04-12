/* Post page: reading progress bar */
document.addEventListener('DOMContentLoaded', function () {
  var bar = document.getElementById('postProgress');
  if (!bar) return;

  function updateProgress() {
    var scrollTop = window.scrollY;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    var pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = Math.min(pct, 100) + '%';
  }

  window.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();
});
