// March Intensive landing page: places-left counter.
// Reads /data/march-intensive-places.json and fills every [data-places] element.
// With nothing taken yet it keeps the static "15 places" text, so the page never
// shows "0 taken". Edit the JSON during launch week to update the counter.
(function () {
  'use strict';

  function label(tier, cap, taken) {
    const left = Math.max(0, cap - taken);
    if (left === 0) return 'Sold out';
    if (taken <= 0) return cap + ' places';
    return left + ' of ' + cap + ' places left';
  }

  function apply(data) {
    document.querySelectorAll('[data-places]').forEach(function (el) {
      const tier = el.getAttribute('data-places');
      const entry = data && data[tier];
      if (!entry || typeof entry.cap !== 'number' || typeof entry.taken !== 'number') return;
      el.textContent = label(tier, entry.cap, entry.taken);
      if (entry.taken >= entry.cap) el.setAttribute('data-sold-out', 'true');
    });
  }

  fetch('/data/march-intensive-places.json', { cache: 'no-store' })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) { if (data) apply(data); })
    .catch(function () { /* keep the static text */ });
}());
