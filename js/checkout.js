(function (global) {
  function loadProductCatalog() {
    if (global && global.ProductCatalog) return global.ProductCatalog;
    if (typeof globalThis !== 'undefined' && globalThis.ProductCatalog) return globalThis.ProductCatalog;
    if (typeof module !== 'undefined' && module.exports) {
      try { return require('./catalog.js'); } catch (e) { return null; }
    }
    return null;
  }

  const _CAT_MODULE = loadProductCatalog();
  const _CAT = _CAT_MODULE ? _CAT_MODULE.CATALOG : {};
  const _getUpsellPriceCents = _CAT_MODULE ? _CAT_MODULE.getUpsellPriceCents : function () { return null; };

  const TALLY_ESSAY_FORM_URL = 'https://tally.so/r/zxQdMR';
  const EMAIL_PATTERN = /^[^\s@.][^\s@]*@[^\s@]+\.[^\s@.]{2,}$/;

  // Derived from catalog — edit js/catalog.js to update products, prices, or availability.
  const UNAVAILABLE_PRODUCT_SLUGS = new Set(
    Object.keys(_CAT).filter(function (k) { return !_CAT[k].available; })
  );

  const PRODUCT_IMAGES = (function () {
    const m = {};
    Object.keys(_CAT).forEach(function (k) { if (_CAT[k].image) m[k] = _CAT[k].image; });
    return m;
  }());

  const MASTERY_INSTALMENT_URL = _CAT.mastery && _CAT.mastery.instalment ? _CAT.mastery.instalment.url : '';

  const PRODUCTS = (function () {
    const m = {};
    Object.keys(_CAT).forEach(function (slug) {
      const e = _CAT[slug];
      const prod = {
        name: e.title,
        tagline: e.tagline || '',
        price: e.priceCents !== null ? e.priceCents / 100 : undefined,
        features: e.features || [],
        isDigital: e.isDigital,
        instalment: e.instalment ? { label: e.instalment.label, url: e.instalment.url } : null,
        successType: e.successType,
      };
      if (e.afterpay) prod.afterpay = true;
      if (e.hasPkgSelector) {
        prod.hasPkgSelector = true;
        prod.packages = (e.packages || []).map(function (pkg) {
          const pkgEntry = _CAT[pkg.slug];
          const pkgPrice = pkgEntry ? pkgEntry.priceCents / 100 : 0;
          return {
            slug: pkg.slug,
            label: pkg.label,
            sub: pkg.sub,
            price: pkgPrice,
            priceDisplay: '$' + (Number.isInteger(pkgPrice) ? pkgPrice.toLocaleString() : pkgPrice.toFixed(2)),
          };
        });
      }
      m[slug] = prod;
    });
    return m;
  }());

  const ORDER_BUMPS = (function () {
    const m = {};
    Object.keys(_CAT).forEach(function (slug) {
      const bump = _CAT[slug].orderBump;
      if (!bump) return;
      const bumpCents = _getUpsellPriceCents(slug, bump.slug);
      m[slug] = Object.assign({}, bump, {
        price: bumpCents !== null ? bumpCents / 100 : bump.price,
      });
    });
    return m;
  }());

  const SECOND_ORDER_BUMPS = (function () {
    const m = {};
    Object.keys(_CAT).forEach(function (slug) {
      const bump = _CAT[slug].secondOrderBump;
      if (!bump) return;
      const bumpCents = _getUpsellPriceCents(slug, bump.slug);
      m[slug] = Object.assign({}, bump, {
        price: bumpCents !== null ? bumpCents / 100 : bump.price,
      });
    });
    return m;
  }());

  const INSTALMENT_PLANS = (function () {
    const m = {};
    Object.keys(_CAT).forEach(function (k) {
      const inst = _CAT[k].instalment;
      if (inst && inst.plan) m[k] = inst.plan;
    });
    return m;
  }());

  let checkoutConfigPromise = null;

  const SUCCESS_MESSAGES = {
    digital: "We've received your payment. Access will be shared to your email via Google Drive within a few hours.",
    'essay-marking': "Payment confirmed. Use the button below to upload your essay — it takes about 30 seconds.",
    'essay-pack-10': 'Your 10-essay pack is confirmed. Email your essays whenever you are ready using the address below.',
    mentoring: "We've received your payment. Check your email for a booking link to schedule your first session.",
    cohort: "We've received your payment. You'll receive an email shortly with everything you need to get started.",
  };

  const SUCCESS_STATES = {
    verifying: {
      icon: '…',
      heading: 'Checking payment',
      message: 'We are verifying your payment with Stripe now.',
    },
    succeeded: {
      icon: '✓',
      heading: 'Payment confirmed',
    },
    processing: {
      icon: '…',
      heading: 'Payment processing',
      message: 'Your payment is still processing. We will email you as soon as it is confirmed.',
    },
    failed: {
      icon: '!',
      heading: 'Payment not confirmed',
      message: 'We could not verify this payment. Please check your email or contact us before trying again.',
    },
  };

  function fmtPrice(value) {
    return value % 1 === 0 ? value.toLocaleString() : value.toFixed(2);
  }

  function escapeText(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function getPayButtonLabel(price) {
    return `Pay $${fmtPrice(price)} AUD →`;
  }

  function getPrimaryButtonLabel(selection) {
    if (selection?.paymentMode === 'instalments') {
      return 'Continue to secure instalment checkout';
    }

    if (selection?.paymentMode === 'afterpay') {
      return 'Continue to Afterpay';
    }

    return getPayButtonLabel(selection?.price ?? 0);
  }

  function getPayButtonPendingLabel() {
    return 'Loading secure payment...';
  }

  function buildPayPalSuccessUrl(selection, paypalOrderId) {
    const params = new URLSearchParams({ product: selection.pageSlug });
    if (paypalOrderId) params.set('paypal_order', paypalOrderId);
    if (selection.apiSlug && selection.apiSlug !== selection.pageSlug) {
      params.set('package', selection.apiSlug);
    }
    if (selection.upsellSelected && selection.upsell) {
      params.set('upsell', selection.upsell.slug);
    }
    return `/checkout/success?${params.toString()}`;
  }

  function loadPayPalSDK(clientId) {
    return new Promise((resolve, reject) => {
      if (global.paypal) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=AUD`;
      script.onload = resolve;
      script.onerror = () => reject(new Error('PayPal SDK failed to load.'));
      document.head.appendChild(script);
    });
  }

  function initPaymentMethodToggle(onSwitch) {
    const toggle = qs('#payment-method-toggle');
    const tabCard = qs('#tab-card');
    const tabPaypal = qs('#tab-paypal');
    if (!toggle || !tabCard || !tabPaypal) return;

    toggle.hidden = false;

    tabCard.addEventListener('click', () => {
      tabCard.classList.add('payment-tab--active');
      tabPaypal.classList.remove('payment-tab--active');
      onSwitch('card');
    });

    tabPaypal.addEventListener('click', () => {
      tabPaypal.classList.add('payment-tab--active');
      tabCard.classList.remove('payment-tab--active');
      onSwitch('paypal');
    });
  }

  function initPayPalButtons(selection) {
    if (!global.paypal) return;

    const container = qs('#paypal-button-container');
    if (!container || container.dataset.ppRendered) return;
    container.dataset.ppRendered = '1';

    global.paypal.Buttons({
      style: {
        layout: 'vertical',
        color: 'gold',
        shape: 'rect',
        label: 'paypal',
        height: 44,
      },
      createOrder: async () => {
        const validation = validateForm();
        if (!validation.ok) {
          showCardError(validation.error);
          throw new Error(validation.error);
        }
        clearCardError();

        const payload = buildCheckoutPayload(selection, validation);
        const response = await fetch('/api/paypal-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, action: 'create' }),
        });
        const result = await parseApiResponse(response);
        if (!result.ok || !result.data.orderID) {
          const msg = result.data.error || 'Payment setup failed. Please try again.';
          showCardError(msg);
          throw new Error(msg);
        }
        return result.data.orderID;
      },
      onApprove: async (data) => {
        const validation = validateForm();
        if (!validation.ok) {
          showCardError(validation.error);
          return;
        }

        if (window.posthog && typeof window.posthog.capture === 'function') {
          window.posthog.capture('checkout_payment_submitted', {
            product: selection.pageSlug,
            total: selection.price,
            upsell_selected: selection.upsellSelected,
            upsell_slug: selection.upsellSelected && selection.upsell ? selection.upsell.slug : null,
            payment_method: 'paypal',
          });
        }

        try {
          const captureResponse = await fetch('/api/paypal-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'capture',
              orderID: data.orderID,
              slug: selection.apiSlug,
              upsellSlug: selection.upsellSelected && selection.upsell ? selection.upsell.slug : null,
              customerName: validation.billingDetails.name,
              email: validation.billingDetails.email,
              phone: validation.billingDetails.phone,
            }),
          });
          const result = await parseApiResponse(captureResponse);
          if (!result.ok || result.data.status !== 'succeeded') {
            throw new Error(result.data.error || 'Payment capture failed. Please try again.');
          }
          window.location.href = buildPayPalSuccessUrl(selection, data.orderID);
        } catch (err) {
          showCardError(err.message || 'Payment failed. Please try again.');
        }
      },
      onError: (err) => {
        console.error('PayPal error:', err);
        showCardError('PayPal payment failed. Please try again or pay by card.');
      },
    }).render('#paypal-button-container');
  }

  function getOrderBumpConfig(pageSlug) {
    const bump = ORDER_BUMPS[pageSlug];
    if (!bump) return null;

    return { ...bump };
  }

  function getSecondOrderBumpConfig(pageSlug) {
    const bump = SECOND_ORDER_BUMPS[pageSlug];
    if (!bump) return null;

    return { ...bump };
  }

  function getUpsellQuantity(selection) {
    if (!selection?.upsellSelected || !selection.upsell) return 0;
    if (!selection.upsell.quantityEnabled) return 1;

    const minQuantity = Math.max(1, Number(selection.upsell.minQuantity) || 1);
    const quantity = Math.floor(Number(selection.upsellQuantity) || minQuantity);
    return Math.max(minQuantity, quantity);
  }

  function getPaymentModeOptions(productSlug) {
    if (PRODUCTS[productSlug]?.afterpay) return ['full', 'afterpay'];
    return INSTALMENT_PLANS[productSlug] ? ['full', 'instalments'] : ['full'];
  }

  function getInstalmentPlanSummary(selection) {
    const plan = INSTALMENT_PLANS[selection?.pageSlug];
    if (!plan) return null;

    const upsellToday = selection?.upsellSelected && selection.upsell
      ? selection.upsell.price * getUpsellQuantity(selection)
      : 0;
    const instalmentCouponAmount = selection?.paymentMode === 'instalments'
      ? (selection?.couponAmount || 0)
      : 0;
    const instalmentDiscountPerPayment = instalmentCouponAmount > 0
      ? Math.floor((instalmentCouponAmount / plan.count) * 100) / 100
      : 0;
    const couponToday = selection?.paymentMode === 'instalments'
      ? instalmentDiscountPerPayment
      : (selection?.couponAmount || 0);
    const dueTodayBeforeDiscount = plan.firstPayment + upsellToday;
    const futurePaymentAmount = Math.max(0, plan.recurringPayment - instalmentDiscountPerPayment);

    return {
      dueToday: Math.max(0, dueTodayBeforeDiscount - couponToday),
      dueTodayBeforeDiscount,
      futurePaymentAmount,
      futurePaymentCount: plan.count - 1,
      futurePaymentCopy: `Then ${plan.count - 1} monthly payments of $${fmtPrice(futurePaymentAmount)}`,
    };
  }

  function getSummaryTotal(selection) {
    if (selection?.paymentMode === 'instalments') {
      return getInstalmentPlanSummary(selection)?.dueToday ?? selection?.price ?? 0;
    }

    return selection?.price ?? 0;
  }

  function buildPaymentModeMarkup(productSlug, selection) {
    const options = getPaymentModeOptions(productSlug);
    if (options.length < 2) return '';

    const activeMode = options.includes(selection?.paymentMode) ? selection.paymentMode : 'full';
    const plan = INSTALMENT_PLANS[productSlug];
    const secondaryOption = options.includes('afterpay')
      ? `
        <label class="payment-mode-option${activeMode === 'afterpay' ? ' payment-mode-option--active' : ''}">
          <input
            class="payment-mode-option__input"
            type="radio"
            name="payment-mode"
            value="afterpay"
            ${activeMode === 'afterpay' ? 'checked' : ''}
          >
          <span class="payment-mode-option__body">
            <strong>Pay in 4 with Afterpay</strong>
            <span>Redirects to Afterpay to finish checkout</span>
          </span>
        </label>
      `
      : `
        <label class="payment-mode-option${activeMode === 'instalments' ? ' payment-mode-option--active' : ''}">
          <input
            class="payment-mode-option__input"
            type="radio"
            name="payment-mode"
            value="instalments"
            ${activeMode === 'instalments' ? 'checked' : ''}
          >
          <span class="payment-mode-option__body">
            <strong>Pay in ${plan.count} monthly payments</strong>
            <span>$${fmtPrice(plan.firstPayment)} due today, then ${plan.count - 1} more monthly instalments</span>
          </span>
        </label>
      `;

    return `
      <div class="payment-mode-toggle" role="radiogroup" aria-label="Payment mode">
        <label class="payment-mode-option${activeMode === 'full' ? ' payment-mode-option--active' : ''}">
          <input
            class="payment-mode-option__input"
            type="radio"
            name="payment-mode"
            value="full"
            ${activeMode === 'full' ? 'checked' : ''}
          >
          <span class="payment-mode-option__body">
            <strong>Pay in full</strong>
            <span>One secure card payment today</span>
          </span>
        </label>
        ${secondaryOption}
      </div>
    `;
  }

  function buildInstalmentSummaryMarkup(selection) {
    const summary = getInstalmentPlanSummary(selection);
    if (!summary) return '';

    return `
      <div class="instalment-summary" aria-label="Instalment summary">
        <div class="instalment-summary__row">
          <span>Due today</span>
          <strong>$${fmtPrice(summary.dueToday)} AUD</strong>
        </div>
        <p class="instalment-summary__copy">${summary.futurePaymentCopy} AUD.</p>
        <p class="instalment-summary__note">Stripe will email you to update your card if a future payment fails.</p>
      </div>
    `;
  }

  function updateSelectionPrice(selection) {
    const upsellPrice = selection.upsellSelected && selection.upsell
      ? selection.upsell.price * getUpsellQuantity(selection)
      : 0;
    const secondUpsellPrice = selection.secondUpsellSelected && selection.secondUpsell
      ? selection.secondUpsell.price
      : 0;
    const subtotal = selection.basePrice + upsellPrice + secondUpsellPrice;
    let couponAmount = 0;
    if (selection.couponDiscount) {
      if (selection.couponDiscount.type === 'percent') {
        couponAmount = Math.floor(subtotal * selection.couponDiscount.value) / 100;
      } else {
        couponAmount = Math.min(selection.couponDiscount.value, subtotal);
      }
    }
    selection.couponAmount = couponAmount;
    selection.price = Math.max(0, subtotal - couponAmount);
    return selection.price;
  }

  function buildOrderBumpMarkup(orderBump, selection, bumpIndex) {
    if (!orderBump) return '';
    const idx = bumpIndex || 1;
    const isSecond = idx === 2;
    const isSelected = isSecond ? Boolean(selection.secondUpsellSelected) : Boolean(selection.upsellSelected);
    const cardId = isSecond ? 'checkout-order-bump-2' : 'checkout-order-bump';
    const inputId = isSecond ? 'order-bump-toggle-2' : 'order-bump-toggle';
    const quantityInputId = isSecond ? 'order-bump-quantity-2' : 'order-bump-quantity';
    const quantityValue = isSecond
      ? Math.max(Number(orderBump.minQuantity) || 1, 1)
      : Math.max(Number(orderBump.minQuantity) || 1, Math.floor(Number(selection.upsellQuantity) || Number(orderBump.minQuantity) || 1));

    const priceMarkup = orderBump.priceWas
      ? `<span class="checkout-upsell__price checkout-upsell__price--discounted"><span class="checkout-upsell__price-was">$${fmtPrice(orderBump.priceWas)}</span><span class="checkout-upsell__price-now">+$${fmtPrice(orderBump.price)}${orderBump.quantityEnabled ? ' each' : ''}</span></span>`
      : `<span class="checkout-upsell__price">+$${fmtPrice(orderBump.price)}${orderBump.quantityEnabled ? ' each' : ''}</span>`;
    const variantClass = orderBump.slug === 'essay-pack-10' ? ' checkout-upsell--essay-pack' : '';
    const quantityMarkup = orderBump.quantityEnabled
      ? `
          <span class="checkout-upsell__quantity">
            <span class="checkout-upsell__quantity-label">${escapeText(orderBump.quantityLabel || 'Quantity')}</span>
            <input
              class="checkout-upsell__quantity-input"
              id="${quantityInputId}"
              type="number"
              min="${Number(orderBump.minQuantity) || 1}"
              step="1"
              value="${quantityValue}"
              inputmode="numeric"
            >
          </span>
        `
      : '';

    return `
      <div class="checkout-upsell checkout-upsell--order-bump${variantClass}${isSelected ? ' checkout-upsell--selected' : ''}" id="${cardId}">
        <label class="checkout-upsell__toggle" for="${inputId}">
          <input
            class="checkout-upsell__input"
            id="${inputId}"
            type="checkbox"
            ${isSelected ? 'checked' : ''}
          >
          <span class="checkout-upsell__control" aria-hidden="true"></span>
          <span class="checkout-upsell__body">
            <span class="checkout-upsell__eyebrow">${orderBump.badge}</span>
            <strong>${orderBump.title}</strong>
            <span>${orderBump.description}</span>
            ${quantityMarkup}
          </span>
          ${priceMarkup}
        </label>
      </div>
    `;
  }

  function buildCheckoutAssuranceMarkup() {
    return `
      <div class="checkout-assurance" aria-label="Checkout reassurance">
        <span>Encrypted card payment</span>
        <span>Refund guarantee honoured</span>
        <span>Receipt sent automatically</span>
      </div>
    `;
  }

  function getInstalmentPlanText(product) {
    const label = String(product?.instalment?.label || '').replace(/^or\s+/i, '').replace(/\s*→$/, '').trim();
    return label || 'Pay by instalments';
  }

  function buildInstalmentLinkMarkup(product) {
    if (!product?.instalment) return '';

    return `
      <span class="checkout-instalment-link__eyebrow">Pay in 4 instalments</span>
      <span class="checkout-instalment-link__main">${getInstalmentPlanText(product)}</span>
      <span class="checkout-instalment-link__note">Opens secure Stripe instalment checkout</span>
    `;
  }

  function getProductFromSearch(search) {
    const params = new URLSearchParams(search || '');
    const slug = params.get('product');
    return PRODUCTS[slug] || null;
  }

  function getInitialSelection(pageSlug, product) {
    const orderBump = getOrderBumpConfig(pageSlug);
    const secondOrderBump = getSecondOrderBumpConfig(pageSlug);

    if (product && product.hasPkgSelector) {
      const defaultIndex = 1;
      const selectedPackage = product.packages[defaultIndex];
      const selection = {
        pageSlug,
        apiSlug: selectedPackage.slug,
        basePrice: selectedPackage.price,
        price: selectedPackage.price,
        packageIndex: defaultIndex,
        upsell: orderBump,
        upsellSelected: false,
        secondUpsell: secondOrderBump,
        secondUpsellSelected: false,
        ...(orderBump && orderBump.quantityEnabled ? { upsellQuantity: Math.max(1, Number(orderBump.minQuantity) || 1) } : {}),
        couponCode: null,
        couponDiscount: null,
        couponAmount: 0,
      };

      updateSelectionPrice(selection);
      return selection;
    }

    const selection = {
      pageSlug,
      apiSlug: pageSlug,
      basePrice: product.price,
      price: product.price,
      packageIndex: null,
      upsell: orderBump,
      upsellSelected: false,
      secondUpsell: secondOrderBump,
      secondUpsellSelected: false,
      ...(orderBump && orderBump.quantityEnabled ? { upsellQuantity: Math.max(1, Number(orderBump.minQuantity) || 1) } : {}),
      couponCode: null,
      couponDiscount: null,
      couponAmount: 0,
    };

    updateSelectionPrice(selection);
    return selection;
  }

  function getSuccessMessage(productSlug) {
    const product = PRODUCTS[productSlug];
    const successType = product ? product.successType : 'cohort';
    return SUCCESS_MESSAGES[successType] || SUCCESS_MESSAGES.cohort;
  }

  function buildSuccessUrl(selection, paymentIntentId) {
    const params = new URLSearchParams({ product: selection.pageSlug });

    if (paymentIntentId) params.set('payment_intent', paymentIntentId);
    if (selection.apiSlug && selection.apiSlug !== selection.pageSlug) {
      params.set('package', selection.apiSlug);
    }

    return `/checkout/success?${params.toString()}`;
  }

  function getSuccessState(status, productSlug) {
    if (status === 'succeeded') {
      return {
        ...SUCCESS_STATES.succeeded,
        message: getSuccessMessage(productSlug),
      };
    }

    if (status === 'processing') {
      return SUCCESS_STATES.processing;
    }

    return SUCCESS_STATES.failed;
  }

  function getSuccessPageTitle(status) {
    if (status === 'succeeded') return "Payment Confirmed | Rohan's GAMSAT";
    if (status === 'processing') return "Payment Processing | Rohan's GAMSAT";
    if (status === 'verifying') return "Checking Payment | Rohan's GAMSAT";
    return "Payment Not Confirmed | Rohan's GAMSAT";
  }

  function isProductAvailable(productSlug) {
    return !UNAVAILABLE_PRODUCT_SLUGS.has(String(productSlug || '').trim());
  }

  function findPackageBySlug(slug) {
    if (!slug) return null;

    for (const product of Object.values(PRODUCTS)) {
      if (!product || !product.packages) continue;

      const pkg = product.packages.find((candidate) => candidate.slug === slug);
      if (pkg) return pkg;
    }

    return null;
  }

  function getDefaultProductVariant(productSlug) {
    const product = PRODUCTS[productSlug];
    if (!product) return null;

    if (!product.packages || !product.packages.length) {
      return product;
    }

    const selection = getInitialSelection(productSlug, product);
    return product.packages[selection.packageIndex] || product.packages[0] || product;
  }

  function buildPurchaseItems(baseSlug, upsellSlug, fallbackBaseSlug) {
    const baseProduct = PRODUCTS[baseSlug] || findPackageBySlug(baseSlug) || getDefaultProductVariant(fallbackBaseSlug);
    const contextualOrderBump = (
      (ORDER_BUMPS[baseSlug] && ORDER_BUMPS[baseSlug].slug === upsellSlug && ORDER_BUMPS[baseSlug])
      || (ORDER_BUMPS[fallbackBaseSlug] && ORDER_BUMPS[fallbackBaseSlug].slug === upsellSlug && ORDER_BUMPS[fallbackBaseSlug])
    );
    const genericUpsellProduct = PRODUCTS[upsellSlug] || findPackageBySlug(upsellSlug);
    const shouldPreferContextualOrderBump = Boolean(
      contextualOrderBump && (
        contextualOrderBump.lockRuntimePrice
        || contextualOrderBump.priceWas
        || !genericUpsellProduct
      )
    );
    const upsellProduct = (shouldPreferContextualOrderBump ? contextualOrderBump : null)
      || genericUpsellProduct
      || Object.values(ORDER_BUMPS).find((bump) => bump.slug === upsellSlug);
    const items = [];

    if (baseProduct) {
      items.push({
        item_id: baseSlug || fallbackBaseSlug,
        item_name: baseProduct.name || baseProduct.label || baseProduct.title || baseSlug || fallbackBaseSlug,
        price: baseProduct.price,
        quantity: 1,
      });
    }

    if (upsellSlug && upsellProduct) {
      items.push({
        item_id: upsellSlug,
        item_name: upsellProduct.name || upsellProduct.title || upsellSlug,
        price: upsellProduct.price,
        quantity: 1,
      });
    }

    return items;
  }

  function getPurchaseValue(items) {
    return items.reduce((total, item) => total + (Number(item.price) || 0), 0) || undefined;
  }

  function trackGa4BeginCheckoutOnce() {
    if (typeof window === 'undefined') return false;
    if (typeof window.gtag !== 'function') return false;

    const key = 'ga4_begin_checkout_comprehensive_course_march_2026';
    try {
      if (window.sessionStorage && window.sessionStorage.getItem(key)) return false;
      if (window.sessionStorage) window.sessionStorage.setItem(key, '1');
    } catch (error) {
      // sessionStorage can be unavailable in private browsing or locked-down contexts.
    }

    window.gtag('event', 'begin_checkout', {
      currency: 'AUD',
      value: 1549,
      items: [
        {
          item_id: 'comprehensive_course_march_2026',
          item_name: 'GAMSAT Comprehensive Course',
          item_category: 'GAMSAT Course',
          price: 1549,
          quantity: 1,
        },
      ],
    });
    return true;
  }

  function trackMetaPurchaseOnce(transactionId, items) {
    if (typeof window.fbq !== 'function') return;

    const safeId = String(transactionId || '').trim();
    if (!safeId) return;

    const key = 'meta_purchase_' + safeId;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch (error) {
      // sessionStorage may be unavailable in private mode
    }

    window.fbq('track', 'Purchase', {
      value: getPurchaseValue(items),
      currency: 'AUD',
      content_ids: items.map((item) => item.item_id).filter(Boolean),
      content_type: 'product',
      num_items: items.length,
    });
  }

  function buildEssayUploadUrl({
    paymentIntentId = '',
    productSlug = 'essay-marking',
    upsellSlug = '',
    uploadToken = '',
    source = 'checkout_success',
  } = {}) {
    const params = new URLSearchParams();
    const safePaymentIntentId = String(paymentIntentId || '').trim();
    const safeProductSlug = String(productSlug || 'essay-marking').trim();
    const safeUpsellSlug = String(upsellSlug || '').trim();
    const safeUploadToken = String(uploadToken || '').trim();
    const safeSource = String(source || 'checkout_success').trim();

    if (safePaymentIntentId) params.set('payment_intent', safePaymentIntentId);
    if (safeProductSlug) params.set('product', safeProductSlug);
    if (safeUpsellSlug) params.set('upsell', safeUpsellSlug);
    if (safeUploadToken) params.set('upload_token', safeUploadToken);
    params.set('source', safeSource);

    return `${TALLY_ESSAY_FORM_URL}?${params.toString()}`;
  }

  function getApiServerErrorMessage(responseText) {
    const trimmed = (responseText || '').trim();
    const isHtml = trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<');

    if (isHtml) {
      return 'Checkout API not found on this server. Run the checkout via Vercel dev at http://127.0.0.1:3000/checkout/?product=...';
    }

    return 'Payment setup failed. Please try again.';
  }

  function getCheckoutSubmissionErrorMessage(message, paymentMode) {
    const safeMessage = String(message || '').trim() || 'Payment setup failed. Please try again.';

    if (paymentMode === 'instalments') {
      const isInstalmentSetupIssue = safeMessage.includes('Missing STRIPE_PRICE_')
        || safeMessage.includes('Missing STRIPE_SECRET_KEY')
        || safeMessage === 'Instalment checkout setup failed. Please try again.';

      if (isInstalmentSetupIssue) {
        return 'Instalments are temporarily unavailable. Please choose pay in full or contact us for help.';
      }
    }

    return safeMessage;
  }

  async function parseApiResponse(response) {
    const responseText = await response.text();

    try {
      return {
        ok: response.ok,
        data: JSON.parse(responseText),
      };
    } catch (error) {
      return {
        ok: false,
        data: {
          error: getApiServerErrorMessage(responseText),
        },
      };
    }
  }

  async function fetchPaymentIntentStatus(paymentIntentId) {
    const response = await global.fetch(
      `/api/payment-status?payment_intent=${encodeURIComponent(paymentIntentId)}`
    );
    const result = await parseApiResponse(response);

    if (!result.ok || !result.data.status) {
      throw new Error(result.data.error || 'We could not verify this payment.');
    }

    return result.data;
  }

  async function fetchCheckoutSessionStatus(sessionId) {
    const response = await global.fetch(
      `/api/payment-status?session_id=${encodeURIComponent(sessionId)}`
    );
    const result = await parseApiResponse(response);

    if (!result.ok || !result.data.status) {
      throw new Error(result.data.error || 'We could not verify this payment.');
    }

    return result.data;
  }

  async function fetchPayPalOrderStatus({
    orderID = '',
    productSlug = '',
    packageSlug = '',
    upsellSlug = '',
  } = {}) {
    const params = new URLSearchParams();
    params.set('paypal_order', String(orderID || '').trim());
    if (productSlug) params.set('product', String(productSlug).trim());
    if (packageSlug) params.set('package', String(packageSlug).trim());
    if (upsellSlug) params.set('upsell', String(upsellSlug).trim());

    const response = await global.fetch(`/api/payment-status?${params.toString()}`);
    const result = await parseApiResponse(response);
    if (!result.ok) {
      throw new Error(result.data.error || 'We could not verify this PayPal payment.');
    }

    return result.data;
  }

  async function fetchCheckoutConfig() {
    const response = await global.fetch('/api/public-config');
    const result = await parseApiResponse(response);

    if (!result.ok || !result.data.stripePublishableKey) {
      throw new Error(result.data.error || 'Checkout configuration is unavailable.');
    }

    return result.data;
  }

  function loadCheckoutConfig() {
    if (!checkoutConfigPromise) {
      checkoutConfigPromise = fetchCheckoutConfig();
    }

    return checkoutConfigPromise;
  }

  function renderSummaryMarkup(product, selection) {
    const summaryTotal = getSummaryTotal(selection);
    const pageSlug = selection && selection.pageSlug;
    const imgSrc = pageSlug && PRODUCT_IMAGES[pageSlug];
    const imgHtml = imgSrc
      ? `<img class="summary-product-img" src="${imgSrc}" alt="${escapeText(product.name)}" loading="eager">`
      : '';

    if (product.hasPkgSelector) {
      return `
        ${imgHtml}
        <div class="summary-badge">Your order</div>
        <h2 class="summary-name">${escapeText(product.name)}</h2>
        ${product.tagline ? `<p class="summary-tagline">${escapeText(product.tagline)}</p>` : ''}
        <hr class="summary-divider">
        <p class="summary-features-label">Choose your package</p>
        <fieldset class="pkg-selector" id="pkg-selector" role="radiogroup" aria-label="Private mentoring package">
          <legend class="pkg-selector-legend">Private mentoring package</legend>
          ${product.packages.map((pkg, index) => `
            <label class="pkg-option${selection.packageIndex === index ? ' pkg-option--active' : ''}" data-index="${index}">
              <input
                class="pkg-option-input"
                type="radio"
                name="mentoring-package"
                value="${pkg.slug}"
                ${selection.packageIndex === index ? 'checked' : ''}
              >
              <span class="pkg-radio" aria-hidden="true"></span>
              <span class="pkg-details">
                <strong>${escapeText(pkg.label)}</strong>
                <span>${escapeText(pkg.sub)}</span>
              </span>
              <span class="pkg-price">${pkg.priceDisplay}</span>
            </label>
          `).join('')}
        </fieldset>
        <hr class="summary-divider">
        <div class="summary-discount-row" id="summary-discount-row" style="${selection.couponAmount > 0 ? '' : 'display:none'}">
          <span>Discount (<span id="summary-coupon-label">${escapeText(selection.couponCode || '')}</span>)</span>
          <span id="summary-discount-amount">-$${fmtPrice(selection.couponAmount || 0)} AUD</span>
        </div>
        <div class="summary-total-row">
          <span>Total due today</span>
          <span id="summary-total">$${fmtPrice(summaryTotal)} AUD</span>
        </div>
        <p class="summary-note">Booking link sent to your email after payment</p>
      `;
    }

    return `
      ${imgHtml}
      <div class="summary-badge">Your order</div>
      <h2 class="summary-name">${escapeText(product.name)}</h2>
      ${product.tagline ? `<p class="summary-tagline">${escapeText(product.tagline)}</p>` : ''}
      <div class="summary-price">$${fmtPrice(product.price)} <small>AUD</small></div>
      <hr class="summary-divider">
      <p class="summary-features-label">What's included</p>
      <ul class="summary-features">
        ${product.features.map((feature) => `<li>${escapeText(feature)}</li>`).join('')}
      </ul>
      <hr class="summary-divider">
      <div class="summary-discount-row" id="summary-discount-row" style="${selection.couponAmount > 0 ? '' : 'display:none'}">
        <span>Discount (<span id="summary-coupon-label">${escapeText(selection.couponCode || '')}</span>)</span>
        <span id="summary-discount-amount">-$${fmtPrice(selection.couponAmount || 0)} AUD</span>
      </div>
      <div class="summary-total-row">
        <span>Total due today</span>
        <span id="summary-total">$${fmtPrice(summaryTotal)} AUD</span>
      </div>
    `;
  }

  function qs(selector) {
    return document.querySelector(selector);
  }

  function showCardError(message) {
    const errorEl = qs('#card-error');
    if (!errorEl) return;

    errorEl.textContent = message;
    errorEl.hidden = false;
    if (typeof errorEl.scrollIntoView === 'function') {
      errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    if (typeof errorEl.focus === 'function') {
      errorEl.focus();
    }
  }

  function clearCardError() {
    const errorEl = qs('#card-error');
    if (!errorEl) return;

    errorEl.hidden = true;
    errorEl.textContent = '';
  }

  function setPayButtonReady(selection, isReady) {
    const button = qs('#pay-btn');
    const label = qs('#pay-btn-label');

    if (button) button.disabled = !isReady;
    if (label) label.textContent = isReady ? getPrimaryButtonLabel(selection) : getPayButtonPendingLabel();
  }

  function setLoading(isLoading, selection) {
    const button = qs('#pay-btn');
    const label = qs('#pay-btn-label');

    if (button) button.disabled = isLoading;
    if (label) {
      label.textContent = isLoading ? 'Processing...' : getPrimaryButtonLabel(selection);
    }
  }

  function renderSummary(product, selection) {
    const container = qs('#checkout-summary');
    if (!container) return;

    container.innerHTML = renderSummaryMarkup(product, selection);

    const summaryUpsell = container.querySelector('#checkout-upsell');
    if (summaryUpsell) {
      summaryUpsell.id = 'checkout-upsell-summary';
    }
  }

  function syncSelectionUI(selection) {
    const totalEl = qs('#summary-total');
    const orderBumpCard = qs('#checkout-order-bump');
    const orderBumpInput = qs('#order-bump-toggle');
    const orderBumpQuantityInput = qs('#order-bump-quantity');
    const paymentModeOptions = document.querySelectorAll('.payment-mode-option');
    const paymentModeInputs = document.querySelectorAll('.payment-mode-option__input');
    const instalmentSummarySlot = qs('#instalment-summary-slot');
    const payButtonLabel = qs('#pay-btn-label');
    const cardWrap = qs('#card-element-wrap');
    const paymentRequestButton = qs('#payment-request-button');
    const paymentRequestSeparator = qs('#payment-request-separator');

    if (totalEl) totalEl.textContent = `$${fmtPrice(getSummaryTotal(selection))} AUD`;

    const discountRow = qs('#summary-discount-row');
    const discountAmountEl = qs('#summary-discount-amount');
    const couponLabelEl = qs('#summary-coupon-label');
    if (discountRow && discountAmountEl) {
      if (selection.couponAmount > 0) {
        if (couponLabelEl) couponLabelEl.textContent = selection.couponCode || '';
        discountAmountEl.textContent = `-$${fmtPrice(selection.couponAmount)} AUD`;
        discountRow.style.display = '';
      } else {
        discountRow.style.display = 'none';
      }
    }

    if (selection.paymentRequest) {
      selection.paymentRequest.update({
        total: { label: 'Total', amount: Math.round(selection.price * 100) },
      });
    }
    if (orderBumpCard) {
      orderBumpCard.classList.toggle('checkout-upsell--selected', Boolean(selection.upsellSelected));
    }
    if (orderBumpInput) {
      orderBumpInput.checked = Boolean(selection.upsellSelected);
    }
    if (orderBumpQuantityInput && selection.upsell?.quantityEnabled) {
      orderBumpQuantityInput.value = String(getUpsellQuantity({
        ...selection,
        upsellSelected: true,
      }));
      orderBumpQuantityInput.disabled = !selection.upsellSelected;
    }

    const secondOrderBumpCard = qs('#checkout-order-bump-2');
    const secondOrderBumpInput = qs('#order-bump-toggle-2');
    if (secondOrderBumpCard) {
      secondOrderBumpCard.classList.toggle('checkout-upsell--selected', Boolean(selection.secondUpsellSelected));
    }
    if (secondOrderBumpInput) {
      secondOrderBumpInput.checked = Boolean(selection.secondUpsellSelected);
    }

    document.querySelectorAll('.pkg-option').forEach((option, index) => {
      option.classList.toggle('pkg-option--active', index === selection.packageIndex);
      option.setAttribute('aria-checked', String(index === selection.packageIndex));
      const input = option.querySelector('.pkg-option-input');
      if (input) input.checked = index === selection.packageIndex;
    });

    paymentModeOptions.forEach((option) => {
      const input = option.querySelector('.payment-mode-option__input');
      option.classList.toggle('payment-mode-option--active', input?.value === selection.paymentMode);
    });

    paymentModeInputs.forEach((input) => {
      input.checked = input.value === selection.paymentMode;
    });

    if (instalmentSummarySlot) {
      if (selection.paymentMode === 'instalments') {
        instalmentSummarySlot.innerHTML = buildInstalmentSummaryMarkup(selection);
        instalmentSummarySlot.hidden = false;
      } else {
        instalmentSummarySlot.innerHTML = '';
        instalmentSummarySlot.hidden = true;
      }
    }

    const hideCardUi = selection.paymentMode !== 'full';

    if (cardWrap) {
      cardWrap.hidden = hideCardUi;
    }

    if (selection.paymentRequest && paymentRequestButton) {
      paymentRequestButton.hidden = hideCardUi;
    }

    if (selection.paymentRequest && paymentRequestSeparator) {
      paymentRequestSeparator.hidden = hideCardUi;
    }

    if (payButtonLabel) {
      payButtonLabel.textContent = getPrimaryButtonLabel(selection);
    }
  }

  function getInstalmentRedirectUrl(selection) {
    if (selection?.paymentMode !== 'instalments') return '';

    const product = PRODUCTS[selection.pageSlug];
    const url = product?.instalment?.url;

    return typeof url === 'string' ? url.trim() : '';
  }

  function redirectToInstalmentCheckout(selection) {
    const url = getInstalmentRedirectUrl(selection);
    if (!url) return false;

    if (window.posthog && typeof window.posthog.capture === 'function') {
      window.posthog.capture('checkout_instalment_redirected', {
        product: selection.pageSlug,
        total: selection.price,
        upsell_selected: selection.upsellSelected,
        upsell_slug: selection.upsellSelected && selection.upsell ? selection.upsell.slug : null,
      });
    }

    window.location.href = url;
    return true;
  }

  function setupPaymentMode(productSlug, selection) {
    const slot = qs('#payment-mode-slot');
    if (!slot) return;

    const markup = buildPaymentModeMarkup(productSlug, selection);
    if (!markup) {
      slot.innerHTML = '';
      slot.hidden = true;
      return;
    }

    const options = getPaymentModeOptions(productSlug);
    selection.paymentMode = options.includes(selection.paymentMode) ? selection.paymentMode : 'full';
    slot.innerHTML = markup;
    slot.hidden = false;

    slot.addEventListener('change', (event) => {
      const input = event.target.closest('.payment-mode-option__input');
      if (!input) return;

      selection.paymentMode = options.includes(input.value) ? input.value : 'full';
      if (selection.paymentMode === 'instalments' && typeof selection.clearCouponState === 'function') {
        selection.clearCouponState();
        return;
      }
      syncSelectionUI(selection);
      setPayButtonReady(selection, Boolean(selection.checkoutReady));
    });
  }

  function setupPackageSelector(product, selection) {
    const selector = qs('#pkg-selector');
    if (!selector) return;

    selector.addEventListener('change', (event) => {
      const input = event.target.closest('.pkg-option-input');
      if (!input) return;

      const option = input.closest('.pkg-option');
      const packageIndex = Number(option.dataset.index);
      if (Number.isNaN(packageIndex) || packageIndex === selection.packageIndex) return;

      const nextPackage = product.packages[packageIndex];
      selection.apiSlug = nextPackage.slug;
      selection.basePrice = nextPackage.price;
      selection.packageIndex = packageIndex;
      updateSelectionPrice(selection);

      syncSelectionUI(selection);
      setPayButtonReady(selection, Boolean(selection.checkoutReady));
    });
  }

  function setupOrderBump(selection) {
    if (!selection.upsell) return;

    const input = qs('#order-bump-toggle');
    const quantityInput = qs('#order-bump-quantity');
    if (!input) return;

    input.addEventListener('change', () => {
      selection.upsellSelected = input.checked;
      if (selection.upsell?.quantityEnabled) {
        selection.upsellQuantity = getUpsellQuantity({
          ...selection,
          upsellSelected: true,
        });
      }
      updateSelectionPrice(selection);
      syncSelectionUI(selection);
      setPayButtonReady(selection, Boolean(selection.checkoutReady));
      if (window.posthog && typeof window.posthog.capture === 'function') {
        window.posthog.capture('checkout_order_bump_toggled', {
          product: selection.pageSlug,
          upsell_slug: selection.upsell ? selection.upsell.slug : null,
          selected: selection.upsellSelected,
        });
      }
    });

    if (quantityInput && selection.upsell.quantityEnabled) {
      quantityInput.addEventListener('input', () => {
        const minQuantity = Math.max(1, Number(selection.upsell.minQuantity) || 1);
        selection.upsellQuantity = Math.max(minQuantity, Math.floor(Number(quantityInput.value) || minQuantity));
        selection.upsellSelected = true;
        input.checked = true;
        updateSelectionPrice(selection);
        syncSelectionUI(selection);
        setPayButtonReady(selection, Boolean(selection.checkoutReady));
      });
    }
  }

  function setupSecondOrderBump(selection) {
    if (!selection.secondUpsell) return;

    const input = qs('#order-bump-toggle-2');
    if (!input) return;

    input.addEventListener('change', () => {
      selection.secondUpsellSelected = input.checked;
      updateSelectionPrice(selection);
      syncSelectionUI(selection);
      setPayButtonReady(selection, Boolean(selection.checkoutReady));
      if (window.posthog && typeof window.posthog.capture === 'function') {
        window.posthog.capture('checkout_order_bump_toggled', {
          product: selection.pageSlug,
          upsell_slug: selection.secondUpsell ? selection.secondUpsell.slug : null,
          selected: selection.secondUpsellSelected,
          bump_index: 2,
        });
      }
    });
  }

  function renderOrderBump(productSlug, selection) {
    const container = qs('#checkout-upsell-slot');
    if (!container) return;

    const orderBump = selection.upsell || getOrderBumpConfig(productSlug);
    const secondOrderBump = selection.secondUpsell || getSecondOrderBumpConfig(productSlug);

    if (!orderBump && !secondOrderBump) {
      container.hidden = true;
      container.innerHTML = '';
      return;
    }

    if (orderBump) selection.upsell = orderBump;
    if (secondOrderBump) selection.secondUpsell = secondOrderBump;

    updateSelectionPrice(selection);
    let markup = orderBump ? buildOrderBumpMarkup(orderBump, selection, 1) : '';
    if (secondOrderBump) markup += buildOrderBumpMarkup(secondOrderBump, selection, 2);
    container.innerHTML = markup;
    container.hidden = false;
    setupOrderBump(selection);
    setupSecondOrderBump(selection);
    syncSelectionUI(selection);
  }

  function attachInstalmentLink(product) {
    if (!product.instalment) return;

    const link = qs('#instalment-link');
    if (!link) return;

    link.href = product.instalment.url;
    link.innerHTML = buildInstalmentLinkMarkup(product);
    link.hidden = false;
  }

  function maybeShowGmailNote(product) {
    if (!product.isDigital) return;

    const note = qs('#gmail-note');
    if (note) note.hidden = false;
  }

  function maybeShowEssayBanner(productSlug) {
    if (productSlug !== 'essay-marking') return;

    const banner = qs('#essay-banner');
    if (banner) banner.hidden = false;
  }

  function validateForm() {
    const firstNameInput = qs('#first-name');
    const lastNameInput = qs('#last-name');
    const emailInput = qs('#email');
    const phoneInput = qs('#phone');
    const addressInput = qs('#billing-address');
    const termsInput = qs('#terms-accepted');

    const firstName = firstNameInput?.value.trim() || '';
    const lastName = lastNameInput?.value.trim() || '';
    const email = emailInput?.value.trim() || '';
    const phone = phoneInput?.value.trim() || '';
    const address = addressInput?.value.trim() || '';

    if (!firstName || !lastName || !email || !phone || !address) {
      return { ok: false, error: 'Please fill in all fields.' };
    }

    if (!emailInput?.checkValidity() || !EMAIL_PATTERN.test(email)) {
      return { ok: false, error: 'Please enter a valid email address.' };
    }

    if (!termsInput?.checked) {
      return { ok: false, error: 'Please agree to the Terms & Conditions before continuing.' };
    }

    return {
      ok: true,
      billingDetails: {
        name: `${firstName} ${lastName}`,
        email,
        phone,
        address: { line1: address },
      },
    };
  }

  function getCustomerPayload(validation) {
    return {
      email: validation.billingDetails.email,
      customerName: validation.billingDetails.name,
      phone: validation.billingDetails.phone,
    };
  }

  function buildCheckoutPayload(selection, validation) {
    const paymentMode = ['instalments', 'afterpay'].includes(selection.paymentMode) ? selection.paymentMode : 'full';
    const payload = {
      slug: selection.apiSlug,
      paymentMode,
      primaryProduct: {
        pageSlug: selection.pageSlug,
        slug: selection.apiSlug,
        price: selection.basePrice,
      },
      totalAmount: selection.price,
      customerName: validation.billingDetails.name,
      email: validation.billingDetails.email,
      phone: validation.billingDetails.phone,
      upsell: null,
      upsellSlug: null,
      upsellPrice: null,
      upsellSelected: false,
      upsell2: null,
      upsellSlug2: null,
      couponCode: selection.couponCode || null,
    };

    if (selection.upsell && selection.upsellSelected) {
      const upsellQuantity = getUpsellQuantity(selection);
      payload.upsell = {
        slug: selection.upsell.slug,
        price: selection.upsell.price,
        title: selection.upsell.title,
      };
      payload.upsellSlug = selection.upsell.slug;
      payload.upsellPrice = selection.upsell.price;
      payload.upsellSelected = true;
      if (selection.upsell.quantityEnabled) {
        payload.upsell.quantity = upsellQuantity;
        payload.upsellQuantity = upsellQuantity;
      }
    }

    if (selection.secondUpsell && selection.secondUpsellSelected) {
      payload.upsell2 = {
        slug: selection.secondUpsell.slug,
        price: selection.secondUpsell.price,
        title: selection.secondUpsell.title,
      };
      payload.upsellSlug2 = selection.secondUpsell.slug;
    }

    return payload;
  }

  async function initPaymentRequestButton(stripe, elements, product, selection) {
    const container = qs('#payment-request-button');
    const separator = qs('#payment-request-separator');
    if (!container) return null;

    const paymentRequest = stripe.paymentRequest({
      country: 'AU',
      currency: 'aud',
      total: { label: product.name, amount: Math.round(selection.price * 100) },
      requestPayerName: true,
      requestPayerEmail: true,
      requestPayerPhone: true,
    });

    const canMakePayment = await paymentRequest.canMakePayment();
    if (!canMakePayment) return null;

    const prButton = elements.create('paymentRequestButton', {
      paymentRequest,
      style: { paymentRequestButton: { type: 'default', theme: 'dark', height: '48px' } },
    });
    prButton.mount('#payment-request-button');
    container.hidden = false;
    if (separator) separator.hidden = false;

    paymentRequest.on('paymentmethod', async (ev) => {
      const payerName = ev.payerName || '';
      const payerEmail = ev.payerEmail || '';
      const payerPhone = ev.payerPhone || '';

      if (!payerEmail || !payerPhone) {
        ev.complete('fail');
        showCardError('Could not retrieve your phone number. Please pay by card below.');
        return;
      }

      if (window.posthog && typeof window.posthog.capture === 'function') {
        window.posthog.capture('checkout_payment_submitted', {
          product: selection.pageSlug,
          total: selection.price,
          upsell_selected: selection.upsellSelected,
          upsell_slug: selection.upsellSelected && selection.upsell ? selection.upsell.slug : null,
          payment_method: canMakePayment.applePay ? 'apple_pay' : 'google_pay',
        });
      }

      try {
        const payload = buildCheckoutPayload(selection, {
          ok: true,
          billingDetails: { name: payerName, email: payerEmail, phone: payerPhone, address: { line1: '' } },
        });

        const response = await fetch('/api/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, mode: 'one_off' }),
        });

        const resultPayload = await parseApiResponse(response);
        if (!resultPayload.ok) {
          ev.complete('fail');
          showCardError(resultPayload.data.error || 'Payment setup failed. Please try again.');
          return;
        }

        const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
          resultPayload.data.clientSecret,
          { payment_method: ev.paymentMethod.id },
          { handleActions: false }
        );

        if (confirmError) {
          ev.complete('fail');
          showCardError(confirmError.message);
          return;
        }

        if (paymentIntent.status === 'requires_action') {
          ev.complete('success');
          const { error: actionError, paymentIntent: finalIntent } = await stripe.confirmCardPayment(resultPayload.data.clientSecret);
          if (actionError) { showCardError(actionError.message); return; }
          window.location.href = buildSuccessUrl(selection, finalIntent.id);
          return;
        }

        ev.complete('success');
        window.location.href = buildSuccessUrl(selection, paymentIntent.id);
      } catch (err) {
        ev.complete('fail');
        showCardError(err.message || 'Payment failed. Please try again.');
      }
    });

    return paymentRequest;
  }

  function setupCoupon(selection) {
    const toggle = qs('#coupon-toggle');
    const form = qs('#coupon-form');
    const input = qs('#coupon-code');
    const applyBtn = qs('#coupon-apply');
    const feedback = qs('#coupon-feedback');

    if (!toggle || !form || !input || !applyBtn) return;

    function setCouponFeedback(message, type) {
      if (!feedback) return;
      feedback.textContent = message;
      feedback.className = `checkout-coupon__feedback checkout-coupon__feedback--${type}`;
      feedback.hidden = false;
    }

    function resetCouponControls() {
      input.disabled = false;
      applyBtn.disabled = false;
      applyBtn.textContent = 'Apply';
    }

    function clearCouponState(options = {}) {
      const preserveFeedback = Boolean(options.preserveFeedback);
      selection.couponCode = null;
      selection.couponDiscount = null;
      selection.couponAmount = 0;
      updateSelectionPrice(selection);
      syncSelectionUI(selection);
      setPayButtonReady(selection, Boolean(selection.checkoutReady));
      input.value = '';
      resetCouponControls();
      if (!preserveFeedback && feedback) {
        feedback.textContent = '';
        feedback.hidden = true;
      }
    }

    selection.clearCouponState = clearCouponState;

    toggle.addEventListener('click', () => {
      const isOpen = !form.hidden;
      form.hidden = isOpen;
      toggle.setAttribute('aria-expanded', String(!isOpen));
      if (!isOpen) input.focus();
    });

    async function applyCoupon() {
      const code = input.value.trim().toUpperCase();
      if (!code) return;

      applyBtn.disabled = true;
      applyBtn.textContent = 'Checking...';
      if (feedback) { feedback.textContent = ''; feedback.hidden = true; }

      try {
        const response = await fetch('/api/validate-coupon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            slug: selection.apiSlug,
            paymentMode: selection.paymentMode,
          }),
        });
        const result = await parseApiResponse(response);

        if (!result.ok || !result.data.valid) {
          setCouponFeedback((result.data && result.data.error) || 'Invalid or expired coupon code.', 'error');
          applyBtn.disabled = false;
          applyBtn.textContent = 'Apply';
          return;
        }

        selection.couponCode = result.data.code || code;
        selection.couponDiscount = result.data.discount;
        updateSelectionPrice(selection);
        syncSelectionUI(selection);
        setPayButtonReady(selection, Boolean(selection.checkoutReady));

        setCouponFeedback(result.data.label || code, 'success');
        input.disabled = true;
        applyBtn.textContent = 'Applied';
      } catch (err) {
        setCouponFeedback('Could not validate coupon. Please try again.', 'error');
        applyBtn.disabled = false;
        applyBtn.textContent = 'Apply';
      }
    }

    applyBtn.addEventListener('click', applyCoupon);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); }
    });
  }

  async function initCheckoutPage() {
    const grid = qs('#checkout-grid');
    const notFound = qs('#checkout-not-found');

    if (!grid || !notFound) return;

    const params = new URLSearchParams(window.location.search);
    const productSlug = params.get('product');
    const product = PRODUCTS[productSlug];

    if (!product) {
      notFound.hidden = false;
      return;
    }

    if (!isProductAvailable(productSlug)) {
      notFound.innerHTML = '<p>This product is currently unavailable. <a href="/contact">Join the waitlist →</a></p>';
      notFound.hidden = false;
      return;
    }

    const selection = getInitialSelection(productSlug, product);
    const requestedPaymentMode = String(params.get('paymentMode') || params.get('payment_mode') || '').trim().toLowerCase();
    const paymentModeOptions = getPaymentModeOptions(productSlug);
    selection.paymentMode = paymentModeOptions.includes(requestedPaymentMode) ? requestedPaymentMode : 'full';

    grid.hidden = false;
    document.title = `${product.name} — Checkout | Rohan's GAMSAT`;

    trackGa4BeginCheckoutOnce();

    if (typeof window.fbq === 'function') {
      window.fbq('track', 'InitiateCheckout', {
        content_ids: [productSlug],
        content_name: product.name,
        content_type: 'product',
        value: selection.price,
        currency: 'AUD',
        num_items: 1,
      });
    }

    renderSummary(product, selection);
    setupPaymentMode(productSlug, selection);
    maybeShowGmailNote(product);
    maybeShowEssayBanner(productSlug);
    renderOrderBump(productSlug, selection);
    selection.checkoutReady = false;

    if (product.hasPkgSelector) {
      setupPackageSelector(product, selection);
      syncSelectionUI(selection);
    }

    setPayButtonReady(selection, false);

    if (typeof global.Stripe !== 'function') {
      showCardError('Stripe.js failed to load. Please refresh and try again.');
      return;
    }

    let stripePublishableKey = '';
    let paypalClientId = '';
    try {
      const config = await loadCheckoutConfig();
      stripePublishableKey = String(config.stripePublishableKey || '').trim();
      // PayPal temporarily disabled — merchant account pending verification
      // paypalClientId = String(config.paypalClientId || '').trim();
    } catch (error) {
      showCardError(error.message || 'Checkout configuration is unavailable.');
      const payButton = qs('#pay-btn');
      if (payButton) payButton.disabled = true;
      return;
    }

    if (!stripePublishableKey || stripePublishableKey.includes('REPLACE_ME')) {
      showCardError('Stripe publishable key is not configured yet.');
      const payButton = qs('#pay-btn');
      if (payButton) payButton.disabled = true;
      return;
    }

    if (paypalClientId) {
      loadPayPalSDK(paypalClientId).then(() => {
        initPayPalButtons(selection);
        initPaymentMethodToggle((method) => {
          const cardWrap = qs('#card-element-wrap');
          const paypalContainer = qs('#paypal-button-container');
          const payBtn = qs('#pay-btn');
          const instalmentLink = qs('#instalment-link');
          if (method === 'paypal') {
            if (cardWrap) cardWrap.hidden = true;
            if (paypalContainer) paypalContainer.hidden = false;
            if (payBtn) payBtn.hidden = true;
            if (instalmentLink) instalmentLink.hidden = true;
          } else {
            if (cardWrap) cardWrap.hidden = false;
            if (paypalContainer) paypalContainer.hidden = true;
            if (payBtn) payBtn.hidden = false;
            if (product.instalment && instalmentLink) instalmentLink.hidden = false;
          }
        });
      }).catch(() => {
        // PayPal SDK failed to load — card-only mode, no toggle shown
      });
    }

    let stripe;
    let elements;
    let cardElement;

    try {
      stripe = global.Stripe(stripePublishableKey);
      elements = stripe.elements();
      cardElement = elements.create('card', {
        style: {
          base: {
            color: '#C9D5E4',
            fontFamily: '"Figtree", system-ui, sans-serif',
            fontSize: '15px',
            fontSmoothing: 'antialiased',
            '::placeholder': { color: '#6B7280' },
          },
          invalid: {
            color: '#ff6b6b',
          },
        },
      });

      cardElement.mount('#card-element');
      cardElement.on('change', (event) => {
        if (event.error) {
          showCardError(event.error.message);
          return;
        }

        clearCardError();
      });
    } catch (error) {
      showCardError('Secure payment failed to load. Please refresh and try again.');
      return;
    }

    selection.checkoutReady = true;
    setPayButtonReady(selection, true);

    setupCoupon(selection);

    initPaymentRequestButton(stripe, elements, product, selection).then((pr) => {
      if (pr) selection.paymentRequest = pr;
    }).catch(() => {});

    const form = qs('#checkout-form');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const validation = validateForm();
      if (!validation.ok) {
        showCardError(validation.error);
        return;
      }

      setLoading(true, selection);

      if (window.posthog && typeof window.posthog.capture === 'function') {
        window.posthog.capture('checkout_payment_submitted', {
          product: selection.pageSlug,
          total: selection.price,
          upsell_selected: selection.upsellSelected,
          upsell_slug: selection.upsellSelected && selection.upsell ? selection.upsell.slug : null,
        });
      }

      try {
        const payload = buildCheckoutPayload(selection, validation);

        if (selection.paymentMode === 'instalments') {
          const response = await fetch('/api/create-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, mode: 'instalment' }),
          });
          const resultPayload = await parseApiResponse(response);
          if (!resultPayload.ok || !resultPayload.data.url) {
            throw new Error(
              getCheckoutSubmissionErrorMessage(resultPayload.data.error, selection.paymentMode)
            );
          }

          window.location.href = resultPayload.data.url;
          return;
        }

        if (selection.paymentMode === 'afterpay') {
          const response = await fetch('/api/create-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, mode: 'instalment' }),
          });
          const resultPayload = await parseApiResponse(response);
          if (!resultPayload.ok || !resultPayload.data.url) {
            throw new Error(resultPayload.data.error || 'Afterpay checkout setup failed. Please try again.');
          }

          window.location.href = resultPayload.data.url;
          return;
        }

        const response = await fetch('/api/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, mode: 'one_off' }),
        });

        const resultPayload = await parseApiResponse(response);
        if (!resultPayload.ok) {
          throw new Error(resultPayload.data.error || 'Payment setup failed. Please try again.');
        }

        const result = await stripe.confirmCardPayment(resultPayload.data.clientSecret, {
          payment_method: {
            card: cardElement,
            billing_details: validation.billingDetails,
          },
        });

        if (result.error) {
          throw new Error(result.error.message);
        }

        if (result.paymentIntent?.status !== 'succeeded') {
          throw new Error('Payment was not completed. Please try again.');
        }

        const paymentIntent = result.paymentIntent || null;
        window.location.href = buildSuccessUrl(
          selection,
          paymentIntent?.id
        );
      } catch (error) {
        showCardError(error.message || 'Payment failed. Please try again.');
        setLoading(false, selection);
      }
    });
  }

  function getSuccessActionMarkup(productSlug, context = {}) {
    const product = PRODUCTS[productSlug];
    if (!product) return null;

    if (product.successType === 'essay-marking') {
      const uploadUrl = buildEssayUploadUrl({
        paymentIntentId: context.paymentIntentId,
        productSlug: context.productSlug || productSlug,
        upsellSlug: context.upsellSlug,
        uploadToken: context.uploadToken,
      });
      const addOnNote = context.upsellSlug === 'essay-collection'
        ? '<p class="success-addon-note">Your Essay Collection add-on is confirmed. Access will be shared to your email via Google Drive.</p>'
        : '';

      return `
        <a href="${uploadUrl}" class="success-tally-btn">Upload Your Essay Now &rarr;</a>
        ${addOnNote}
        <p class="success-fallback">Alternatively, email your essay directly to <a href="mailto:essays@rohanstutoring.com">essays@rohanstutoring.com</a></p>
      `;
    }

    if (product.successType === 'essay-pack-10') {
      return `
        <p class="success-email-label">Email your essays to:</p>
        <a href="mailto:essays@rohanstutoring.com" class="success-email-address">essays@rohanstutoring.com</a>
        <p class="success-email-note">Include your name in the subject line. Your pack covers 10 essays.</p>
      `;
    }

    return null;
  }

  function renderSuccessAction(productSlug, context = {}) {
    const actionEl = qs('#success-action');
    if (!actionEl) return;

    const markup = getSuccessActionMarkup(productSlug, context);
    if (!markup) return;

    actionEl.innerHTML = markup;
    actionEl.hidden = false;
  }

  async function initSuccessPage() {
    const messageEl = qs('#success-message');
    const headingEl = qs('#success-heading');
    const iconEl = qs('#success-icon');

    if (!messageEl || !headingEl || !iconEl) return;

    const params = new URLSearchParams(window.location.search);
    const productSlug = params.get('product');
    const paymentIntentId = params.get('payment_intent');
    const checkoutSessionId = params.get('session_id');

    function renderState(state, statusKey) {
      iconEl.textContent = state.icon;
      headingEl.textContent = state.heading;
      messageEl.textContent = state.message;
      document.title = getSuccessPageTitle(statusKey);
    }

    const paypalOrderId = params.get('paypal_order');

    if (paypalOrderId) {
      renderState(SUCCESS_STATES.verifying, 'verifying');

      try {
        const packageSlug = params.get('package') || '';
        const upsellSlug = params.get('upsell') || '';
        const statusPayload = await fetchPayPalOrderStatus({
          orderID: paypalOrderId,
          productSlug,
          packageSlug,
          upsellSlug,
        });
        const metadata = statusPayload.metadata || {};
        const successProductSlug = metadata.base_slug || packageSlug || productSlug;
        const successMessageProductSlug = PRODUCTS[successProductSlug] ? successProductSlug : productSlug;
        const verifiedUpsellSlug = metadata.upsell_slug || upsellSlug || '';
        const state = getSuccessState(statusPayload.status, successMessageProductSlug);

        renderState(state, statusPayload.status);
        if (statusPayload.status === 'succeeded') {
          renderSuccessAction(successMessageProductSlug, {
            paymentIntentId: paypalOrderId,
            productSlug: successMessageProductSlug,
            upsellSlug: verifiedUpsellSlug,
          });
          if (typeof window.gtag === 'function') {
            const items = buildPurchaseItems(successProductSlug, verifiedUpsellSlug, productSlug);
            window.gtag('event', 'purchase', {
              transaction_id: paypalOrderId,
              currency: 'AUD',
              value: items.reduce((t, i) => t + (Number(i.price) || 0), 0) || undefined,
              items,
            });
            trackMetaPurchaseOnce(paypalOrderId, items);
          }
          if (window.posthog && typeof window.posthog.capture === 'function') {
            const items = buildPurchaseItems(successProductSlug, verifiedUpsellSlug, productSlug);
            window.posthog.capture('checkout_completed', {
              transaction_id: paypalOrderId,
              currency: 'AUD',
              value: items.reduce((t, i) => t + (Number(i.price) || 0), 0) || undefined,
              product: successMessageProductSlug,
              upsell_slug: verifiedUpsellSlug || null,
              payment_method: 'paypal',
            });
          }
        }
      } catch (error) {
        renderState(SUCCESS_STATES.failed, 'failed');
      }
      return;
    }

    renderState(SUCCESS_STATES.verifying, 'verifying');

    if (!paymentIntentId || typeof global.fetch !== 'function') {
      if (checkoutSessionId && typeof global.fetch === 'function') {
        try {
          const statusPayload = await fetchCheckoutSessionStatus(checkoutSessionId);
          const status = statusPayload.status;
          const metadata = statusPayload.metadata || {};
          const successProductSlug = metadata.base_slug || metadata.product_slug || productSlug;
          const upsellSlug = metadata.upsell_slug || params.get('upsell') || '';
          const successMessageProductSlug = PRODUCTS[successProductSlug] ? successProductSlug : productSlug;

          renderState(getSuccessState(status, successMessageProductSlug), status);
          if (status === 'succeeded') {
            renderSuccessAction(successMessageProductSlug, {
              paymentIntentId: statusPayload.paymentIntentId || checkoutSessionId,
              productSlug: successMessageProductSlug,
              upsellSlug,
            });
          }
        } catch (error) {
          renderState(SUCCESS_STATES.failed, 'failed');
        }
        return;
      }

      renderState(SUCCESS_STATES.failed, 'failed');
      return;
    }

    try {
      const statusPayload = await fetchPaymentIntentStatus(paymentIntentId);
      const status = statusPayload.status;
      const metadata = statusPayload.metadata || {};
      const successProductSlug = metadata.base_slug || metadata.product_slug || params.get('package') || productSlug;
      const upsellSlug = metadata.upsell_slug || params.get('upsell') || '';
      const uploadToken = metadata.essay_upload_token || '';
      const successMessageProductSlug = PRODUCTS[successProductSlug] ? successProductSlug : productSlug;

      renderState(getSuccessState(status, successMessageProductSlug), status);
      if (status === 'succeeded') {
        renderSuccessAction(successMessageProductSlug, {
          paymentIntentId,
          productSlug: successMessageProductSlug,
          upsellSlug,
          uploadToken,
        });
        if (typeof window.gtag === 'function') {
          const items = buildPurchaseItems(successProductSlug, upsellSlug, productSlug);

          window.gtag('event', 'purchase', {
            transaction_id: paymentIntentId,
            currency: 'AUD',
            value: items.reduce((total, item) => total + (Number(item.price) || 0), 0) || undefined,
            items,
          });
          trackMetaPurchaseOnce(paymentIntentId, items);
        }
        if (window.posthog && typeof window.posthog.capture === 'function') {
          const items = buildPurchaseItems(successProductSlug, upsellSlug, productSlug);
          window.posthog.capture('checkout_completed', {
            transaction_id: paymentIntentId,
            currency: 'AUD',
            value: items.reduce((total, item) => total + (Number(item.price) || 0), 0) || undefined,
            product: successMessageProductSlug,
            upsell_slug: upsellSlug || null,
          });
        }
      }
    } catch (error) {
      renderState(SUCCESS_STATES.failed, 'failed');
    }
  }

  const exported = {
    MASTERY_INSTALMENT_URL,
    TALLY_ESSAY_FORM_URL,
    EMAIL_PATTERN,
    PRODUCTS,
    ORDER_BUMPS,
    INSTALMENT_PLANS,
    UNAVAILABLE_PRODUCT_SLUGS,
    fmtPrice,
    getPayButtonLabel,
    getPrimaryButtonLabel,
    getPayButtonPendingLabel,
    getProductFromSearch,
    getInitialSelection,
    getOrderBumpConfig,
    getSecondOrderBumpConfig,
    getPaymentModeOptions,
    getInstalmentPlanSummary,
    buildPaymentModeMarkup,
    buildInstalmentSummaryMarkup,
    updateSelectionPrice,
    getSuccessMessage,
    buildSuccessUrl,
    getSuccessState,
    getSuccessPageTitle,
    isProductAvailable,
    buildPurchaseItems,
    trackGa4BeginCheckoutOnce,
    buildEssayUploadUrl,
    getApiServerErrorMessage,
    getCheckoutSubmissionErrorMessage,
    parseApiResponse,
    fetchCheckoutConfig,
    loadCheckoutConfig,
    fetchPaymentIntentStatus,
    fetchCheckoutSessionStatus,
    fetchPayPalOrderStatus,
    getCustomerPayload,
    buildCheckoutPayload,
    renderSummaryMarkup,
    buildOrderBumpMarkup,
    buildCheckoutAssuranceMarkup,
    buildInstalmentLinkMarkup,
    getInstalmentRedirectUrl,
    redirectToInstalmentCheckout,
    getSuccessActionMarkup,
    renderSuccessAction,
    initCheckoutPage,
    initSuccessPage,
    initPaymentRequestButton,
    setupCoupon,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }

  if (typeof window !== 'undefined') {
    window.CheckoutPage = exported;
    document.addEventListener('DOMContentLoaded', async () => {
      try {
        const config = await loadCheckoutConfig();
        if (config && config.amounts) {
          for (const [slug, amount] of Object.entries(config.amounts)) {
            if (PRODUCTS[slug]) {
              PRODUCTS[slug].price = amount;
            } else {
              for (const product of Object.values(PRODUCTS)) {
                if (product.hasPkgSelector && product.packages) {
                  const pkg = product.packages.find(p => p.slug === slug);
                  if (pkg) {
                    pkg.price = amount;
                    pkg.priceDisplay = '$' + fmtPrice(amount);
                  }
                }
              }
            }
          }
          for (const bump of Object.values(ORDER_BUMPS)) {
            if (!bump.lockRuntimePrice && config.amounts[bump.slug] !== undefined) {
              bump.price = config.amounts[bump.slug];
            }
          }
        }
      } catch (err) {
        console.warn('Could not fetch dynamic prices, falling back to hardcoded defaults.');
      }
      await initCheckoutPage();
      await initSuccessPage();

      // Essay upload click → fires when user clicks the Tally upload button
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.success-tally-btn')) return;
        if (typeof window.gtag === 'function') {
          window.gtag('event', 'essay_upload_started');
        }
        if (window.posthog && typeof window.posthog.capture === 'function') {
          window.posthog.capture('essay_upload_started');
        }
      });
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
