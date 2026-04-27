document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('.floating-quiz-cta')?.remove();
  document.body.classList.remove('has-floating-quiz-cta');

  const modal = document.querySelector('[data-tracker-preview-modal]');
  const openButton = document.querySelector('[data-tracker-preview-open]');
  const closeButton = document.querySelector('[data-tracker-preview-close]');

  if (!modal || !openButton || !closeButton || typeof modal.showModal !== 'function') {
    return;
  }

  const closePreview = () => {
    modal.close();
    document.body.classList.remove('tracker-preview-open');
  };

  openButton.addEventListener('click', () => {
    modal.showModal();
    document.body.classList.add('tracker-preview-open');
    modal.querySelector('.tracker-preview-modal__scroller')?.focus();
  });

  closeButton.addEventListener('click', closePreview);

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closePreview();
    }
  });

  modal.addEventListener('close', () => {
    document.body.classList.remove('tracker-preview-open');
    window.setTimeout(() => openButton.focus({ preventScroll: true }), 0);
  });
});
