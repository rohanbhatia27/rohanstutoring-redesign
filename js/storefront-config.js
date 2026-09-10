(function (global) {
  const StorefrontConfig = Object.freeze({
    instalmentLinks: Object.freeze({
      // Keep these in step with the instalment blocks in js/catalog.js.
      // Instalment totals are deliberately higher than paying upfront, and the
      // label must always state the total.
      // 1 OCTOBER 2026 CUTOVER: comprehensive goes back to $499 x 4 ($1,996 total).
      comprehensive: Object.freeze({
        label: 'or 4 × $449 instalments ($1,796 total) →',
        url: '/checkout/?product=comprehensive&paymentMode=instalments',
      }),
      mastery: Object.freeze({
        label: 'or 4 × $699 instalments ($2,796 total) →',
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
