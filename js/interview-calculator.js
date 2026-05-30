(function () {
  'use strict';

  function round5(n) {
    return Math.max(0, Math.min(100, Math.round(n / 5) * 5));
  }

  // Honours midpoints: UQ publishes ranges; we use the midpoint as an estimate.
  var UQ_HON_MAP = { class1: 7.0, class2a: 6.75, class2b: 5.75, class3: 4.5 };

  function computeComboScore(input, weighting, uni) {
    var gpaScale = weighting.gpaScale || 7;
    var bonuses = (input && input.bonuses) || {};
    var id = (uni && uni.id) || '';
    var adjustedGpa = input.gpa;

    // UQ: research degree and honours adjustments to GPA before combo calc.
    if (id === 'uq') {
      if (bonuses.uqResearch === 'phd_mphil') {
        adjustedGpa = 7.0;
      } else if (bonuses.uqResearch === 'masters') {
        adjustedGpa = Math.min(gpaScale, adjustedGpa + 0.2);
      } else if (bonuses.uqHonours && UQ_HON_MAP[bonuses.uqHonours] !== undefined) {
        adjustedGpa = Math.max(adjustedGpa, UQ_HON_MAP[bonuses.uqHonours]);
      }
      adjustedGpa = Math.min(gpaScale, adjustedGpa);
    }

    // MQ: rural (+3%), indigenous (+3%), MQ Clinical grad (+3%) — capped at 5% total.
    if (id === 'macquarie') {
      var mqPct = 0;
      if (input.rural)           mqPct += 3;
      if (bonuses.indigenous)    mqPct += 3;
      if (bonuses.mqClinical)    mqPct += 3;
      adjustedGpa = Math.min(gpaScale, adjustedGpa * (1 + Math.min(mqPct, 5) / 100));
    }

    var sw = weighting.sectionWeights || [1, 1, 1];
    var swSum = sw[0] + sw[1] + sw[2];
    var gamsat = (input.sections[0] * sw[0] + input.sections[1] * sw[1] + input.sections[2] * sw[2]) / swSum;
    var combo = adjustedGpa / gpaScale + gamsat / 100;

    // Deakin: additive bonuses to the combo score, capped at 12%.
    if (id === 'deakin') {
      var deakinBonus = 0;
      if (bonuses.deakinGrad)           deakinBonus += 4;
      if (bonuses.ahpraClinical)        deakinBonus += 4;
      else if (bonuses.workExp)         deakinBonus += 2;
      if (bonuses.financialDisadvantage) deakinBonus += 2;
      var ruralPct = Math.max(0, Math.min(4, parseFloat(bonuses.deakinRural) || 0));
      deakinBonus = Math.min(deakinBonus + ruralPct, 12);
      combo += deakinBonus / 100;
    }

    return combo;
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
      var score = computeComboScore(input, uni.weighting, uni);
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
      var dataPromise = fetch('/data/gemsas-cutoffs.json?v=20260531', { cache: 'no-store' }).then(function (r) { return r.json(); });

      ['ic-gamsat-s1', 'ic-gamsat-s2', 'ic-gamsat-s3'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', function () {
          var v = parseFloat(this.value);
          if (this.value === '' || isNaN(v)) return;
          if (v < 0)   this.value = '0';
          if (v > 100) this.value = '100';
        });
      });

      // Deakin AHPRA and non-clinical work are mutually exclusive.
      var ahpraEl   = document.getElementById('ic-ahpra');
      var workexpEl = document.getElementById('ic-workexp');
      if (ahpraEl && workexpEl) {
        ahpraEl.addEventListener('change', function () {
          workexpEl.disabled = ahpraEl.checked;
          if (ahpraEl.checked) workexpEl.checked = false;
        });
        workexpEl.addEventListener('change', function () {
          ahpraEl.disabled = workexpEl.checked;
          if (workexpEl.checked) ahpraEl.checked = false;
        });
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        dataPromise.then(function (data) {
          function checked(id) { var el = document.getElementById(id); return !!(el && el.checked); }
          function val(id)     { var el = document.getElementById(id); return el ? el.value : ''; }
          var input = {
            gpa: parseFloat(val('ic-gpa')),
            sections: [
              parseFloat(val('ic-gamsat-s1')),
              parseFloat(val('ic-gamsat-s2')),
              parseFloat(val('ic-gamsat-s3'))
            ],
            casperQuartile: parseInt(val('ic-casper'), 10) || null,
            rural: checked('ic-rural'),
            bonuses: {
              indigenous:           checked('ic-indigenous'),
              mqClinical:           checked('ic-mq-clinical'),
              deakinGrad:           checked('ic-deakin-grad'),
              ahpraClinical:        checked('ic-ahpra'),
              workExp:              checked('ic-workexp'),
              financialDisadvantage: checked('ic-financial'),
              deakinRural:          parseFloat(val('ic-deakin-rural')) || 0,
              uqResearch:           val('ic-uq-research') || null,
              uqHonours:            val('ic-uq-honours') || null
            }
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
