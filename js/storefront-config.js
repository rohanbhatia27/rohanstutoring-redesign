(function (global) {
  const StorefrontConfig = Object.freeze({
    instalmentLinks: Object.freeze({
      // Keep these in step with the instalment blocks in js/catalog.js.
      // Instalment totals are deliberately higher than paying upfront, and the
      // label must always state the total.
      comprehensive: Object.freeze({
        label: 'or 4 × $499 instalments ($1,996 total) →',
        url: '/checkout/?product=comprehensive&paymentMode=instalments',
      }),
      mastery: Object.freeze({
        label: 'or 4 × $749 instalments ($2,996 total) →',
        url: '/checkout/?product=mastery&paymentMode=instalments',
      }),
    }),
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorefrontConfig;
  }

  if (global) {
    global.StorefrontConfig = StorefrontConfig;
  }
})(typeof window !== 'undefined' ? window : globalThis);
