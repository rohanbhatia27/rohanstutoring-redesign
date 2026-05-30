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
