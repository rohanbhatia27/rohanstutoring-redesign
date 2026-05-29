const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const consentScript = fs.readFileSync(path.join(ROOT, 'js/consent.js'), 'utf8');
const analyticsScript = fs.readFileSync(path.join(ROOT, 'js/analytics.js'), 'utf8');

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

test('analytics sends GA4 view_item on comprehensive course product pages', () => {
  const appendedScripts = [];
  const context = {
    Date,
    document: {
      currentScript: { dataset: {} },
      readyState: 'complete',
      head: {
        appendChild(script) {
          appendedScripts.push(script);
        },
      },
      querySelector() {
        return null;
      },
      createElement(tagName) {
        return {
          tagName,
          async: false,
          src: '',
        };
      },
      getElementsByTagName() {
        return [{ parentNode: { insertBefore() {} } }];
      },
    },
    window: {
      __analyticsConsent: { granted: true, pending: false },
      location: { pathname: '/courses/comprehensive' },
      addEventListener() {},
    },
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.Date = Date;

  vm.runInNewContext(analyticsScript, context);

  const viewItemCall = context.window.dataLayer
    .map((entry) => Array.from(entry))
    .find(([command, eventName]) => command === 'event' && eventName === 'view_item');

  assert.ok(viewItemCall, 'expected a GA4 view_item event');
  assert.equal(viewItemCall[2].currency, 'AUD');
  assert.equal(viewItemCall[2].value, 1699);
  assert.deepEqual(JSON.parse(JSON.stringify(viewItemCall[2].items)), [{
    item_id: 'comprehensive',
    item_name: 'Comprehensive Course',
    price: 1699,
    quantity: 1,
  }]);
  assert.ok(appendedScripts.some((script) => script.src.includes('googletagmanager.com/gtag/js')));
});
