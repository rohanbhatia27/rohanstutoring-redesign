(function (global) {
  const StorefrontConfig = Object.freeze({
    instalmentLinks: Object.freeze({
      // Comprehensive has no instalment option during the March 2027 early
      // bird window. Restore this entry at the 1 October cutover, alongside
      // the instalment block in js/catalog.js.
      mastery: Object.freeze({
        label: 'or pay $699 × 4 instalments →',
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
