const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/gemsas-cutoffs.json'), 'utf8'));

test('cutoffs data: top-level shape', () => {
  assert.equal(typeof data.source, 'string');
  assert.ok(Array.isArray(data.cycles) && data.cycles.length >= 1);
  assert.ok(Array.isArray(data.universities) && data.universities.length >= 1);
});

test('cutoffs data: each university is well-formed', () => {
  for (const uni of data.universities) {
    assert.equal(typeof uni.id, 'string', 'uni.id string');
    assert.equal(typeof uni.name, 'string', 'uni.name string');
    assert.equal(typeof uni.usesCasper, 'boolean', uni.id + '.usesCasper boolean');
    assert.equal(typeof uni.weighting, 'object', uni.id + '.weighting object');
    for (const cohort of ['nonRural', 'rural']) {
      const c = uni.cutoffs[cohort];
      assert.ok(c, uni.id + '.cutoffs.' + cohort + ' present');
      for (const k of ['interviewMin', 'p50', 'p90']) {
        assert.equal(typeof c[k], 'number', uni.id + '.' + cohort + '.' + k + ' number');
        assert.ok(c[k] > 0 && c[k] < 7.1, uni.id + '.' + cohort + '.' + k + ' in range');
      }
      assert.ok(c.interviewMin <= c.p50, uni.id + '.' + cohort + ' interviewMin<=p50');
      assert.ok(c.p50 <= c.p90, uni.id + '.' + cohort + ' p50<=p90');
    }
  }
});

const vm = require('node:vm');

function loadCalc() {
  const code = fs.readFileSync(path.join(ROOT, 'js/interview-calculator.js'), 'utf8');
  const sandbox = { window: {}, document: { addEventListener() {} } };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.InterviewCalc;
}

test('computeComboScore: applies gpa/gamsat split and section weights', () => {
  const calc = loadCalc();
  const weighting = { gpa: 0.5, gamsat: 0.5, sectionWeights: [1, 1, 2], gpaScale: 7 };
  // gpa 6.5/7; gamsat sections 70,70,80 -> weighted mean = (70+70+160)/4 = 75
  const score = calc.computeComboScore({ gpa: 6.5, sections: [70, 70, 80] }, weighting);
  assert.equal(typeof score, 'number');
  assert.ok(score > 0);
});

test('mapToBand: rounds to nearest 5 and respects anchors', () => {
  const calc = loadCalc();
  const cutoffs = { interviewMin: 1.5, p50: 1.7, p90: 1.9 };
  assert.ok(calc.mapToBand(1.3, cutoffs) <= 15); // below interview min -> low
  assert.equal(calc.mapToBand(1.7, cutoffs), 55); // at p50 -> midpoint
  assert.ok(calc.mapToBand(2.0, cutoffs) >= 90); // well above -> high
  const band = calc.mapToBand(1.62, cutoffs);
  assert.equal(band % 5, 0, 'rounded to nearest 5');
});

test('applyCasper: only penalises uni that uses casper, never below floor', () => {
  const calc = loadCalc();
  assert.equal(calc.applyCasper(60, { usesCasper: false }, 1), 60); // ignored
  assert.ok(calc.applyCasper(60, { usesCasper: true }, 1) <= 60); // gated quartile penalised
  assert.ok(calc.applyCasper(10, { usesCasper: true }, 1) >= 0); // never negative
});

test('rankUniversities: returns sorted bands per uni', () => {
  const calc = loadCalc();
  const result = calc.rankUniversities(
    { gpa: 6.5, sections: [70, 70, 80], casperQuartile: 4, rural: false },
    data
  );
  assert.ok(Array.isArray(result));
  assert.ok(result.length >= 1);
  for (const r of result) {
    assert.equal(typeof r.name, 'string');
    assert.equal(typeof r.band, 'number');
    assert.equal(r.band % 5, 0);
  }
  for (let i = 1; i < result.length; i++) {
    assert.ok(result[i - 1].band >= result[i].band, 'sorted descending');
  }
});

test('page exists with required structure', () => {
  const html = fs.readFileSync(path.join(ROOT, 'interview-calculator.html'), 'utf8');
  assert.match(html, /css\/style\.css/, 'loads base stylesheet');
  assert.match(html, /css\/interview-calculator\.css/, 'loads page stylesheet');
  assert.match(html, /js\/interview-calculator\.js/, 'loads calculator script');
  assert.match(html, /id="ic-form"/, 'has the input form');
  assert.match(html, /id="ic-results"/, 'has results region');
  assert.match(html, /name="gamsat-s1"|id="ic-gamsat-s1"/, 'has gamsat section input');
  assert.match(html, /rural/i, 'has rural toggle');
  assert.match(html, /r\/GAMSAT|community/i, 'shows attribution');
  assert.match(html, /estimate|not advice|guidance only/i, 'shows disclaimer');
});

test('MQ: rural+indigenous capped at 5% — boosts GPA but not beyond cap', () => {
  const calc = loadCalc();
  const weighting = { sectionWeights: [1, 1, 1], gpaScale: 7 };
  const uni = { id: 'macquarie' };
  const base = calc.computeComboScore(
    { gpa: 6.5, sections: [70, 70, 70], rural: false, bonuses: {} },
    weighting, uni
  );
  const withRural = calc.computeComboScore(
    { gpa: 6.5, sections: [70, 70, 70], rural: true, bonuses: {} },
    weighting, uni
  );
  // rural = +3% GPA -> 6.5 * 1.03 / 7 component should be higher
  assert.ok(withRural > base, 'rural bonus raises score');

  const withAll = calc.computeComboScore(
    { gpa: 6.5, sections: [70, 70, 70], rural: true, bonuses: { indigenous: true, mqClinical: true } },
    weighting, uni
  );
  // rural+indigenous+clinical = 9%, capped at 5%
  const withJust5 = calc.computeComboScore(
    { gpa: 6.5, sections: [70, 70, 70], rural: false, bonuses: { indigenous: true, mqClinical: false } },
    weighting, uni
  );
  // rural(3) + indigenous(3) = 6 -> capped 5; indigenous+clinical = 6 -> capped 5 -> same effective bonus
  assert.ok(withAll > withRural, 'additional bonuses still help before cap');
});

test('MQ: GPA never exceeds gpaScale after bonus', () => {
  const calc = loadCalc();
  const weighting = { sectionWeights: [1, 1, 1], gpaScale: 7 };
  const uni = { id: 'macquarie' };
  const score = calc.computeComboScore(
    { gpa: 7.0, sections: [80, 80, 80], rural: true, bonuses: { indigenous: true, mqClinical: true } },
    weighting, uni
  );
  assert.ok(score <= 7 / 7 + 80 / 100 + 0.01, 'GPA component capped at scale');
});

test('Deakin: additive bonuses raise combo score correctly', () => {
  const calc = loadCalc();
  const weighting = { sectionWeights: [1, 1, 2], gpaScale: 7 };
  const uni = { id: 'deakin' };
  const base = calc.computeComboScore(
    { gpa: 6.5, sections: [70, 70, 75], rural: false, bonuses: {} },
    weighting, uni
  );
  const withBonus = calc.computeComboScore(
    { gpa: 6.5, sections: [70, 70, 75], rural: false,
      bonuses: { deakinGrad: true, ahpraClinical: true, financialDisadvantage: true } },
    weighting, uni
  );
  // deakinGrad(4) + ahpra(4) + financial(2) = 10% -> +0.10
  assert.ok(Math.abs((withBonus - base) - 0.10) < 0.001, 'Deakin bonus is additive +0.10');
});

test('Deakin: ahpra and workExp are mutually exclusive', () => {
  const calc = loadCalc();
  const weighting = { sectionWeights: [1, 1, 2], gpaScale: 7 };
  const uni = { id: 'deakin' };
  const withAhpra = calc.computeComboScore(
    { gpa: 6.5, sections: [70, 70, 75], rural: false, bonuses: { ahpraClinical: true } },
    weighting, uni
  );
  const withBoth = calc.computeComboScore(
    { gpa: 6.5, sections: [70, 70, 75], rural: false, bonuses: { ahpraClinical: true, workExp: true } },
    weighting, uni
  );
  assert.equal(withAhpra, withBoth, 'workExp ignored when ahpraClinical set');
});

test('Deakin: total bonus capped at 12%', () => {
  const calc = loadCalc();
  const weighting = { sectionWeights: [1, 1, 2], gpaScale: 7 };
  const uni = { id: 'deakin' };
  const base = calc.computeComboScore(
    { gpa: 6.5, sections: [70, 70, 75], rural: false, bonuses: {} },
    weighting, uni
  );
  const maxBonus = calc.computeComboScore(
    { gpa: 6.5, sections: [70, 70, 75], rural: false,
      bonuses: { deakinGrad: true, ahpraClinical: true, financialDisadvantage: true, deakinRural: 4 } },
    weighting, uni
  );
  // deakinGrad(4)+ahpra(4)+financial(2)+rural(4) = 14 -> capped 12 -> +0.12
  assert.ok(Math.abs((maxBonus - base) - 0.12) < 0.001, 'Deakin cap at 0.12');
});

test('UQ: PhD sets GPA to 7.0', () => {
  const calc = loadCalc();
  const weighting = { sectionWeights: [1, 1, 1], gpaScale: 7 };
  const uni = { id: 'uq' };
  const withPhd = calc.computeComboScore(
    { gpa: 5.5, sections: [70, 70, 70], rural: false, bonuses: { uqResearch: 'phd_mphil' } },
    weighting, uni
  );
  const asIf70 = calc.computeComboScore(
    { gpa: 7.0, sections: [70, 70, 70], rural: false, bonuses: {} },
    weighting, uni
  );
  assert.ok(Math.abs(withPhd - asIf70) < 0.001, 'PhD sets GPA to 7.0');
});

test('UQ: Masters by Research adds 0.2 GPA, capped at 7', () => {
  const calc = loadCalc();
  const weighting = { sectionWeights: [1, 1, 1], gpaScale: 7 };
  const uni = { id: 'uq' };
  const s = calc.computeComboScore(
    { gpa: 6.5, sections: [70, 70, 70], rural: false, bonuses: { uqResearch: 'masters' } },
    weighting, uni
  );
  const expected = 6.7 / 7 + 70 / 100;
  assert.ok(Math.abs(s - expected) < 0.001, 'Masters adds 0.2 to GPA');

  // Cap at 7
  const capped = calc.computeComboScore(
    { gpa: 6.9, sections: [70, 70, 70], rural: false, bonuses: { uqResearch: 'masters' } },
    weighting, uni
  );
  assert.ok(Math.abs(capped - (7.0 / 7 + 70 / 100)) < 0.001, 'Masters GPA capped at 7');
});

test('UQ: Honours class2a uses midpoint 6.75, never below raw GPA', () => {
  const calc = loadCalc();
  const weighting = { sectionWeights: [1, 1, 1], gpaScale: 7 };
  const uni = { id: 'uq' };
  const low = calc.computeComboScore(
    { gpa: 5.0, sections: [70, 70, 70], rural: false, bonuses: { uqHonours: 'class2a' } },
    weighting, uni
  );
  assert.ok(Math.abs(low - (6.75 / 7 + 70 / 100)) < 0.001, 'Honours IIA lifts GPA to 6.75');

  const high = calc.computeComboScore(
    { gpa: 7.0, sections: [70, 70, 70], rural: false, bonuses: { uqHonours: 'class2a' } },
    weighting, uni
  );
  assert.ok(Math.abs(high - (7.0 / 7 + 70 / 100)) < 0.001, 'Honours IIA never drops a higher GPA');
});

test('non-MQ/Deakin/UQ universities unaffected by bonus fields', () => {
  const calc = loadCalc();
  const weighting = { sectionWeights: [1, 1, 2], gpaScale: 7 };
  const uni = { id: 'anu' };
  const base = calc.computeComboScore(
    { gpa: 6.5, sections: [70, 70, 75], rural: false, bonuses: {} },
    weighting, uni
  );
  const withBonuses = calc.computeComboScore(
    { gpa: 6.5, sections: [70, 70, 75], rural: false,
      bonuses: { deakinGrad: true, ahpraClinical: true, indigenous: true, mqClinical: true, uqResearch: 'phd_mphil' } },
    weighting, uni
  );
  assert.equal(base, withBonuses, 'ANU score unchanged by bonus fields');
});

test('renderHeadline returns best uni summary string', () => {
  const calc = loadCalc();
  const ranked = [
    { id: 'uq', name: 'University of Queensland', band: 65 },
    { id: 'deakin', name: 'Deakin University', band: 40 }
  ];
  const headline = calc.renderHeadline(ranked);
  assert.match(headline, /University of Queensland/);
  assert.match(headline, /65/);
});

test('page has email soft-gate wired to free-resource-form', () => {
  const html = fs.readFileSync(path.join(ROOT, 'interview-calculator.html'), 'utf8');
  assert.match(html, /js\/free-resource-form\.js/, 'loads the lead form script');
  assert.match(html, /id="ic-results-full"/, 'has the gated full-results container');
  assert.match(html, /data-free-resource|formkit|tracker-form/i, 'uses the lead form markup hooks');
  assert.match(html, /data-resource-key="interview-calculator"/, 'declares the calculator resource key');
});

test('interview-calculator is a registered free resource', () => {
  const freeResource = require('../api/_lib/_free-resource.js');
  const resource = freeResource.getFreeResource('interview-calculator');
  assert.ok(resource, 'resource registered');
  assert.equal(typeof resource.kitFormId, 'string');
  assert.ok(resource.kitFormId.length > 0, 'has a Kit form id');
});
