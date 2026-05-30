(function () {
  'use strict';

  function round5(n) {
    return Math.max(0, Math.min(100, Math.round(n / 5) * 5));
  }

  function computeComboScore(input, weighting) {
    var sw = weighting.sectionWeights || [1, 1, 1];
    var swSum = sw[0] + sw[1] + sw[2];
    var gamsat = (input.sections[0] * sw[0] + input.sections[1] * sw[1] + input.sections[2] * sw[2]) / swSum;
    var gpaScale = weighting.gpaScale || 7;
    return input.gpa / gpaScale + gamsat / 100;
  }

  // Piecewise-linear: interviewMin -> 15, p50 -> 55, p90 -> 90, above p90 -> 95.
  // p50 and p90 are the 50th/90th percentiles of the 2025 no-bonus interview pool.
  function mapToBand(score, cutoffs) {
    var low = cutoffs.interviewMin;
    var mid = cutoffs.p50;
    var hi  = cutoffs.p90;
    var pct;
    if (score <= low)  { pct = Math.max(5, 15 - (low - score) * 100); }
    else if (score <= mid) { pct = 15 + ((score - low) / (mid - low)) * (55 - 15); }
    else if (score <= hi)  { pct = 55 + ((score - mid) / (hi  - mid)) * (90 - 55); }
    else { pct = 95; }
    return round5(pct);
  }

  function applyCasper(band, uni, casperPenaltyBands) {
    if (!uni.usesCasper) return band;
    return round5(Math.max(0, band - casperPenaltyBands * 5));
  }

  function rankUniversities(input, data) {
    var cohort = input.rural ? 'rural' : 'nonRural';
    var casperGateBelow = (data.casper && data.casper.gatedQuartileBelow) || 2;
    var penaltyBands = (data.casper && data.casper.penaltyBands) || 1;
    var out = data.universities.map(function (uni) {
      var score = computeComboScore(input, uni.weighting);
      var band = mapToBand(score, uni.cutoffs[cohort]);
      var penalty = (input.casperQuartile && input.casperQuartile < casperGateBelow) ? penaltyBands : 0;
      band = applyCasper(band, uni, penalty);
      return { id: uni.id, name: uni.name, band: band, usesCasper: uni.usesCasper };
    });
    out.sort(function (a, b) { return b.band - a.band; });
    return out;
  }

  function renderHeadline(ranked) {
    if (!ranked || !ranked.length) return 'Enter your scores to see your estimate.';
    var top = ranked[0];
    return 'Your strongest interview chance is <span class="interview-calc__headline-tease">' +
      top.name + ' at about ' + top.band + '%</span>.';
  }

  window.InterviewCalc = {
    round5: round5,
    computeComboScore: computeComboScore,
    mapToBand: mapToBand,
    applyCasper: applyCasper,
    rankUniversities: rankUniversities,
    renderHeadline: renderHeadline
  };

  if (typeof document !== 'undefined' && document.getElementById) {
    document.addEventListener('DOMContentLoaded', function () {
      var form = document.getElementById('ic-form');
      if (!form) return;
      var results = document.getElementById('ic-results');
      var fullBox = document.getElementById('ic-results-full');
      var fullBody = document.getElementById('ic-results-body');
      var headlineEl = document.getElementById('ic-headline');
      var dataPromise = fetch('/data/gemsas-cutoffs.json?v=20260530', { cache: 'no-store' }).then(function (r) { return r.json(); });

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        dataPromise.then(function (data) {
          var input = {
            gpa: parseFloat(document.getElementById('ic-gpa').value),
            sections: [
              parseFloat(document.getElementById('ic-gamsat-s1').value),
              parseFloat(document.getElementById('ic-gamsat-s2').value),
              parseFloat(document.getElementById('ic-gamsat-s3').value)
            ],
            casperQuartile: parseInt(document.getElementById('ic-casper').value, 10) || null,
            rural: !!(document.getElementById('ic-rural') && document.getElementById('ic-rural').checked)
          };
          var ranked = window.InterviewCalc.rankUniversities(input, data);
          if (results) results.hidden = false;
          if (headlineEl) headlineEl.innerHTML = window.InterviewCalc.renderHeadline(ranked);
          if (fullBody) {
            fullBody.innerHTML = ranked.map(function (r) {
              return '<tr><td>' + r.name + '</td><td>' + r.band + '%</td></tr>';
            }).join('');
          }
        });
      });

      // Soft email gate: the full breakdown stays hidden until the lead form
      // succeeds (or falls back), at which point we reveal #ic-results-full.
      if (typeof window.initFreeResourceForms === 'function') {
        window.initFreeResourceForms({
          resourceName: 'Interview Chances Calculator',
          successInlineMessage: "You're in. Your full school-by-school breakdown is unlocked below.",
          successCardMessage: "You're in. Your full school-by-school breakdown is unlocked below.",
          onLeadCaptured: function () {
            if (results) results.classList.add('interview-calc__results--unlocked');
            if (fullBox) fullBox.hidden = false;
          }
        });
      }
    });
  }
})();
