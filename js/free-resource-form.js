(function () {
  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showStatusNote(form, message) {
    var note = form.nextElementSibling;
    if (!note || !note.hasAttribute('data-free-resource-note')) {
      note = document.createElement('div');
      note.setAttribute('data-free-resource-note', 'true');
      note.className = 'formkit-alert';
      form.insertAdjacentElement('afterend', note);
    }
    note.innerHTML = escapeHtml(message);
  }

  function clearStatusNote(form) {
    var note = form.nextElementSibling;
    if (note && note.hasAttribute('data-free-resource-note')) {
      note.remove();
    }
  }

  function showSuccess(form, options) {
    form.setAttribute('data-state', 'success');
    clearStatusNote(form);

    if (form.classList.contains('tracker-form')) {
      form.innerHTML = '<p class="tracker-form__success">' + escapeHtml(options.successCardMessage) + '</p>';
      return;
    }

    form.innerHTML = '<div class="formkit-alert">' + escapeHtml(options.successInlineMessage) + '</div>';
  }

  function showFallback(form, payload, options) {
    var fallback = payload && payload.fallback ? payload.fallback : {};
    var message = payload && payload.message
      ? payload.message
      : 'Delivery is delayed. Use the backup option below.';
    var linkHtml = fallback.url
      ? ' <a href="' + escapeHtml(fallback.url) + '"' + (fallback.kind === 'download' ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + escapeHtml(fallback.label || 'Open the backup option') + '</a>'
      : '';
    var emailCopy = fallback.emailSent
      ? ' I also sent the same backup path to your inbox.'
      : '';

    form.setAttribute('data-state', 'fallback');
    clearStatusNote(form);

    if (form.classList.contains('tracker-form')) {
      form.innerHTML = '<div class="tracker-form__success"><strong>' + escapeHtml(options.resourceName) + ' request received.</strong><br>' + escapeHtml(message + emailCopy) + linkHtml + '</div>';
      return;
    }

    form.innerHTML = '<div class="formkit-alert"><strong>' + escapeHtml(options.resourceName) + ' request received.</strong> ' + escapeHtml(message + emailCopy) + linkHtml + '</div>';
  }

  function getPayload(form) {
    var firstNameInput = form.querySelector('input[name="fields[first_name]"]');
    var emailInput = form.querySelector('input[name="email_address"]');

    return {
      resourceKey: form.getAttribute('data-resource-key') || '',
      firstName: firstNameInput ? firstNameInput.value : '',
      email: emailInput ? emailInput.value : '',
    };
  }

  function submitNatively(form) {
    HTMLFormElement.prototype.submit.call(form);
  }

  window.initFreeResourceForms = function initFreeResourceForms(options) {
    var forms = document.querySelectorAll('.seva-form[data-resource-key]');
    if (!forms.length) return;

    forms.forEach(function (form) {
      form.addEventListener('submit', async function (event) {
        var btn = form.querySelector('[type="submit"]');
        var originalText = btn ? btn.innerHTML : '';
        var response;
        var payload;

        event.preventDefault();
        clearStatusNote(form);

        if (btn) {
          btn.disabled = true;
          btn.innerHTML = '<span>Sending...</span>';
        }

        try {
          response = await fetch('/api/free-resource-lead', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(getPayload(form)),
          });
          payload = await response.json().catch(function () { return null; });
        } catch (_) {
          if (btn) {
            btn.innerHTML = '<span>Opening secure backup...</span>';
          }
          submitNatively(form);
          return;
        }

        if (!response.ok || !payload || payload.ok !== true) {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
          }
          showStatusNote(form, payload && payload.error ? payload.error : 'Something went wrong. Please try again.');
          return;
        }

        if (payload.status === 'fallback') {
          showFallback(form, payload, options);
        } else {
          showSuccess(form, options);
        }

        if (typeof options.onLeadCaptured === 'function') {
          options.onLeadCaptured(payload.status, payload);
        }
      });
    });
  };
})();
