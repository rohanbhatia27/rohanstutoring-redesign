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

  // Piecewise-linear: interviewMin -> 15, offerMean -> 50, +0.15 above mean -> 95.
  function mapToBand(score, cutoffs) {
    var low = cutoffs.interviewMin;
    var mid = cutoffs.offerMean;
    var hi = mid + 0.15;
    var pct;
    if (score <= low) { pct = Math.max(5, 15 - (low - score) * 100); }
    else if (score <= mid) { pct = 15 + ((score - low) / (mid - low)) * (50 - 15); }
    else if (score <= hi) { pct = 50 + ((score - mid) / (hi - mid)) * (95 - 50); }
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

  window.InterviewCalc = {
    round5: round5,
    computeComboScore: computeComboScore,
    mapToBand: mapToBand,
    applyCasper: applyCasper,
    rankUniversities: rankUniversities
  };

  // DOM wiring (reading inputs, rendering results) is added in a later task.
})();
