(function (global) {
  const StorefrontConfig = Object.freeze({
    instalmentLinks: Object.freeze({
      comprehensive: Object.freeze({
        label: 'or pay $449 × 4 instalments →',
        url: 'https://buy.stripe.com/8x25kDeDWdUC2u1eaMeEo0m',
      }),
      mastery: Object.freeze({
        label: 'or pay $649 × 4 instalments →',
        url: 'https://buy.stripe.com/cNi8wP53m5o69Wt7MoeEo0o',
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
