(function (global) {
  const StorefrontConfig = Object.freeze({
    instalmentLinks: Object.freeze({
      comprehensive: Object.freeze({
        label: 'or pay $499 × 4 instalments →',
        url: '/checkout/?product=comprehensive&paymentMode=instalments',
      }),
      mastery: Object.freeze({
        label: 'or pay $649 × 4 instalments →',
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
