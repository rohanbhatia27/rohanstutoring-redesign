const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const consentScript = fs.readFileSync(path.join(ROOT, 'js/consent.js'), 'utf8');

function runConsentScript(storedValue) {
  const appended = [];
  const listeners = {};
  const context = {
    CustomEvent: function CustomEvent(type) {
      this.type = type;
    },
    document: {
      readyState: 'complete',
      body: {
        appendChild(el) {
          appended.push(el);
        },
      },
      createElement(tagName) {
        return {
          tagName,
          id: '',
          setAttribute() {},
          remove() {},
        };
      },
      getElementById(id) {
        if (id === 'consent-banner') return appended.find((el) => el.id === id) || null;
        return {
          addEventListener(type, handler) {
            listeners[id + ':' + type] = handler;
          },
        };
      },
      addEventListener() {},
    },
    localStorage: {
      getItem(key) {
        assert.equal(key, 'rohan_analytics_consent');
        return storedValue;
      },
      setItem() {},
    },
    window: {
      dispatchEvent() {},
    },
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.localStorage = context.localStorage;
  context.window.CustomEvent = context.CustomEvent;

  vm.runInNewContext(consentScript, context);
  return { appended, context };
}

test('analytics consent banner stays hidden after a stored decline', () => {
  const { appended, context } = runConsentScript('denied');

  assert.equal(context.window.__analyticsConsent.granted, false);
  assert.equal(context.window.__analyticsConsent.pending, false);
  assert.equal(appended.length, 0);
});
