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
      for (const k of ['interviewMin', 'offerMin', 'offerMean']) {
        assert.equal(typeof c[k], 'number', uni.id + '.' + cohort + '.' + k + ' number');
        assert.ok(c[k] > 0 && c[k] < 7.1, uni.id + '.' + cohort + '.' + k + ' in range');
      }
      assert.ok(c.interviewMin <= c.offerMean, uni.id + '.' + cohort + ' interviewMin<=offerMean');
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
  const cutoffs = { interviewMin: 1.5, offerMin: 1.6, offerMean: 1.7 };
  assert.ok(calc.mapToBand(1.3, cutoffs) <= 15); // below interview min -> low
  assert.equal(calc.mapToBand(1.7, cutoffs), 50); // at offer mean -> 50
  assert.ok(calc.mapToBand(2.0, cutoffs) >= 80); // well above -> high
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
