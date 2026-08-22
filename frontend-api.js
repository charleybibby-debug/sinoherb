(function () {
  "use strict";

  var paypalSdkPromise;
  var paypalActions;
  var activeCheckout;

  function escapeText(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character];
    });
  }

  async function request(path, options) {
    var response = await fetch("/api/v1" + path, Object.assign({
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
    }, options || {}));
    var payload = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(payload.error && payload.error.message ? payload.error.message : "后台服务暂时不可用");
    return payload.data;
  }

  function checkoutCustomer(form) {
    return Object.fromEntries(new FormData(form));
  }

  function validateCheckoutForm(form) {
    return form.reportValidity();
  }

  function showCheckoutMessage(message, isError) {
    var target = document.querySelector("#checkoutMessage");
    if (!target) return;
    target.textContent = message;
    target.dataset.state = isError ? "error" : "success";
  }

  function setCheckoutBusy(form, busy) {
    form.querySelectorAll("button").forEach(function (button) { button.disabled = busy; });
    if (paypalActions) {
      if (busy || !form.checkValidity()) paypalActions.disable();
      else paypalActions.enable();
    }
    form.setAttribute("aria-busy", String(busy));
  }

  function loadPaypalSdk(clientId, currency) {
    if (window.paypal) return Promise.resolve(window.paypal);
    if (paypalSdkPromise) return paypalSdkPromise;
    paypalSdkPromise = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.dataset.paypalSdk = "true";
      script.src = "https://www.paypal.com/sdk/js?client-id=" + encodeURIComponent(clientId) + "&currency=" + encodeURIComponent(currency) + "&intent=capture&components=buttons&enable-funding=card";
      script.onload = function () { resolve(window.paypal); };
      script.onerror = function () {
        script.remove();
        paypalSdkPromise = null;
        reject(new Error("PAYPAL_SDK_FAILED"));
      };
      document.head.appendChild(script);
    });
    return paypalSdkPromise;
  }

  async function submitManualOrder(form) {
    if (!validateCheckoutForm(form)) return;
    setCheckoutBusy(form, true);
    try {
      var order = await request("/orders", { method: "POST", body: JSON.stringify(checkoutCustomer(form)) });
      showCheckoutMessage("订单 " + order.orderNumber + " 已提交，我们会联系你确认付款与配送。");
      form.reset();
    } catch (error) {
      showCheckoutMessage(error.message, true);
    } finally {
      setCheckoutBusy(form, false);
    }
  }

  function renderPaypalButtons(form) {
    return window.paypal.Buttons({
      style: { layout: "vertical", shape: "rect", label: "paypal" },
      onInit: function (_, actions) {
        paypalActions = actions;
        actions.disable();
        ["input", "change"].forEach(function (eventName) {
          form.addEventListener(eventName, function () {
            if (form.checkValidity()) actions.enable();
            else actions.disable();
          });
        });
      },
      createOrder: async function () {
        if (!validateCheckoutForm(form)) throw new Error("请先填写完整配送信息。");
        setCheckoutBusy(form, true);
        try {
          activeCheckout = await request("/payments/paypal/orders", {
            method: "POST",
            body: JSON.stringify(checkoutCustomer(form)),
          });
          return activeCheckout.paypalOrderId;
        } catch (error) {
          showCheckoutMessage(error.message, true);
          throw error;
        } finally {
          setCheckoutBusy(form, false);
        }
      },
      onApprove: async function (data) {
        setCheckoutBusy(form, true);
        try {
          var paid = await request("/payments/paypal/orders/" + encodeURIComponent(data.orderID) + "/capture", {
            method: "POST",
            body: JSON.stringify({ checkoutToken: activeCheckout && activeCheckout.checkoutToken }),
          });
          window.location.assign("./order-confirmation.html?order=" + encodeURIComponent(paid.orderNumber) + "&token=" + encodeURIComponent(activeCheckout.checkoutToken));
        } catch (error) {
          showCheckoutMessage(error.message, true);
          setCheckoutBusy(form, false);
        }
      },
      onCancel: function () {
        setCheckoutBusy(form, false);
        showCheckoutMessage("你已取消 PayPal 支付，购物车仍为你保留。");
      },
      onError: function () {
        setCheckoutBusy(form, false);
        showCheckoutMessage("PayPal 暂时无法完成付款，请重试或选择人工联系。", true);
      },
    }).render("#paypalButtons");
  }

  async function setupPaypal(form) {
    var status = document.querySelector("#paypalStatus");
    var retry = document.querySelector("#paypalRetry");
    var card = document.querySelector("[data-payment-method='paypal']");
    if (!status || !retry || !card) return;
    status.textContent = "正在检查 PayPal 可用性…";
    status.dataset.state = "loading";
    retry.hidden = true;
    try {
      var config = await request("/payments/paypal/config");
      if (!config.enabled) {
        card.dataset.state = "disabled";
        status.textContent = "PayPal 尚未启用，你仍可提交人工联系订单。";
        status.dataset.state = "disabled";
        return;
      }
      await loadPaypalSdk(config.clientId, config.currency);
      if (!window.paypal || !window.paypal.Buttons) throw new Error("PAYPAL_SDK_FAILED");
      status.textContent = "配送信息填写完整后即可使用 PayPal。";
      status.dataset.state = "ready";
      await renderPaypalButtons(form);
    } catch (error) {
      status.textContent = "PayPal 加载失败，请重试或选择人工联系。";
      status.dataset.state = "error";
      retry.hidden = false;
    }
  }

  function renderCart(cart) {
    document.querySelectorAll(".cart-button__badge").forEach(function (badge) {
      badge.textContent = String((cart.items || []).reduce(function (sum, item) { return sum + item.quantity; }, 0));
    });
    var items = document.querySelector(".cart-drawer__items");
    if (items) {
      items.innerHTML = cart.items && cart.items.length ? cart.items.map(function (item) {
        return "<article class=\"cart-item\"><span class=\"cart-item__thumb cart-item__thumb--sage\"></span><div><h3>" + escapeText(item.product.name) + "</h3><p>" + escapeText(item.product.category) + " · " + escapeText(item.product.constitutionType) + "</p></div><strong>" + escapeText(item.lineTotal) + "</strong></article>";
      }).join("") : "<p>购物车还没有商品。</p>";
    }
    var subtotal = document.querySelector(".cart-drawer__summary strong");
    if (subtotal) subtotal.textContent = cart.subtotal;
    var pageItems = document.querySelector("#cartPageItems");
    if (pageItems) {
      pageItems.innerHTML = cart.items && cart.items.length ? cart.items.map(function (item) {
        return "<article class=\"checkout-summary__item\"><div class=\"checkout-summary__line\"><strong>" + escapeText(item.product.name) + " × " + item.quantity + "</strong><span>" + escapeText(item.lineTotal) + "</span></div><p>" + escapeText(item.product.category) + " · " + escapeText(item.product.constitutionType) + "</p></article>";
      }).join("") : "<p>购物车还没有商品，请先浏览产品。</p>";
      var pageTotal = document.querySelector("#cartPageTotal strong");
      if (pageTotal) pageTotal.textContent = cart.subtotal;
    }
  }

  async function syncProducts() {
    var cards = Array.from(document.querySelectorAll("[data-product-card]"));
    if (!cards.length) return;
    var products = await request("/products");
    var byName = new Map(products.map(function (product) { return [product.name, product]; }));
    cards.forEach(function (card) {
      var product = byName.get(card.dataset.name);
      if (!product) {
        card.hidden = true;
        return;
      }
      card.dataset.price = String(product.priceCents / 100);
      var price = card.querySelector(".store-product-card__body strong");
      if (price) price.textContent = product.price;
      card.hidden = product.status !== "active";
    });
  }

  async function syncMedia() {
    var elements = Array.from(document.querySelectorAll("[data-media-slot]"));
    if (!elements.length) return;
    var media = await request("/media");
    var bySlot = new Map(media.map(function (asset) { return [asset.slotKey, asset]; }));
    elements.forEach(function (element) {
      var asset = bySlot.get(element.dataset.mediaSlot);
      if (!asset || !asset.url) return;
      element.classList.add("has-media");
      if (element.tagName === "IMG") {
        element.src = asset.url;
        element.alt = asset.altText || element.alt;
        return;
      }
      var image = element.querySelector("img[data-media-rendered]");
      if (!image) {
        image = document.createElement("img");
        image.dataset.mediaRendered = "true";
        image.className = "media-slot-image";
        element.appendChild(image);
      }
      image.src = asset.url;
      image.alt = asset.altText || "";
    });
  }

  async function syncCheckout() {
    var form = document.querySelector("#checkoutForm");
    if (!form) return;
    var cart = await request("/cart");
    var items = document.querySelector("#checkoutItems");
    var total = document.querySelector("#checkoutTotal strong");
    var paypalAmount = document.querySelector("#paypalAmount");
    if (items) {
      items.innerHTML = cart.items.length ? cart.items.map(function (item) {
        return "<article class=\"checkout-summary__item\"><div class=\"checkout-summary__line\"><strong>" + escapeText(item.product.name) + " × " + item.quantity + "</strong><span>" + escapeText(item.lineTotal) + "</span></div><p>" + escapeText(item.product.category) + " · " + escapeText(item.product.constitutionType) + "</p></article>";
      }).join("") : "<p>购物车为空，请先选择产品。</p>";
    }
    if (total) total.textContent = cart.subtotal;
    if (paypalAmount) paypalAmount.textContent = cart.subtotal + " USD";
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      submitManualOrder(form);
    });
    var retry = document.querySelector("#paypalRetry");
    if (retry) retry.addEventListener("click", function () {
      paypalSdkPromise = null;
      var buttons = document.querySelector("#paypalButtons");
      if (buttons) buttons.innerHTML = "";
      setupPaypal(form);
    });
    await setupPaypal(form);
  }

  async function syncOrderConfirmation() {
    var target = document.querySelector("#orderConfirmation");
    if (!target) return;
    var params = new URLSearchParams(window.location.search);
    var orderNumber = params.get("order") || "";
    var token = params.get("token") || "";
    try {
      var order = await request("/orders/" + encodeURIComponent(orderNumber) + "/confirmation?token=" + encodeURIComponent(token));
      var paymentStatus = order.paymentStatus === "refunded" ? "已退款" : "已付款";
      target.innerHTML = "<span class=\"eyebrow\">Payment complete</span><h1>付款已确认</h1><p>订单 " + escapeText(order.orderNumber) + " · " + escapeText(order.subtotal) + " USD</p><p>支付状态 " + paymentStatus + " · 交易参考号 " + escapeText(order.transactionReference || "—") + "</p><p>我们会继续确认配送安排，并通过你填写的联系方式与你联系。</p><a class=\"button button--primary\" href=\"./products.html\">继续浏览</a>";
    } catch (error) {
      target.innerHTML = "<span class=\"eyebrow\">Confirmation unavailable</span><h1>无法读取订单详情</h1><p>请检查链接，或联系 SinoHerb 支持。</p><a class=\"button\" href=\"./index.html\">返回首页</a>";
    }
  }

  async function syncProductDetail() {
    var addButton = document.querySelector("[data-product-add]");
    if (!addButton) return;
    var slug = new URLSearchParams(window.location.search).get("product") || "balance-daily-pack";
    var product = await request("/products/" + encodeURIComponent(slug));
    var detailMedia = document.querySelector("[data-media-slot$='.detail']");
    if (detailMedia) {
      detailMedia.dataset.mediaSlot = "product." + slug + ".detail";
      await syncMedia();
    }
    var title = document.querySelector("[data-detail-title]");
    var subtitle = document.querySelector("[data-detail-subtitle]");
    var category = document.querySelector("[data-detail-category]");
    var price = document.querySelector("[data-detail-price]");
    var compare = document.querySelector("[data-detail-compare]");
    if (title) title.textContent = product.name;
    if (subtitle) subtitle.textContent = product.subtitle;
    if (category) category.textContent = product.category + " · " + product.constitutionType;
    if (price) price.textContent = product.price;
    if (compare) compare.textContent = product.compareAtPrice;
    addButton.addEventListener("click", async function (event) {
      event.preventDefault();
      var quantitySelect = document.querySelector(".quantity-control select");
      var quantity = Number(quantitySelect && quantitySelect.value ? quantitySelect.value : 1);
      try {
        await request("/cart/items", { method: "POST", body: JSON.stringify({ productId: product.id, quantity: quantity }) });
        window.location.href = "./cart.html";
      } catch (error) {
        addButton.textContent = error.message;
      }
    });
  }

  async function setupChat() {
    var composer = document.querySelector("#chatComposer");
    var input = document.querySelector("#chatInput");
    var transcript = document.querySelector("#chatTranscript");
    var resultPanel = document.querySelector("#chatResult");
    if (!composer || !input || !transcript || !resultPanel) return;
    var session;
    try {
      session = await request("/chat/sessions", { method: "POST", body: "{}" });
    } catch (error) {
      return;
    }
    composer.addEventListener("submit", async function (event) {
      var content = input.value.trim();
      if (!content || input.disabled) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      var userMessage = document.createElement("p");
      userMessage.className = "chat-message chat-message--user";
      userMessage.textContent = content;
      transcript.appendChild(userMessage);
      input.value = "";
      input.disabled = true;
      try {
        var response = await fetch("/api/v1/chat/sessions/" + session.id + "/messages", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content: content }),
        });
        if (!response.ok || !response.body) throw new Error("聊天服务暂时不可用");
        var reader = response.body.getReader();
        var decoder = new TextDecoder();
        var buffer = "";
        var constitutionResult = null;
        while (true) {
          var chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          var events = buffer.split("\n\n");
          buffer = events.pop() || "";
          events.forEach(function (eventText) {
            var dataLine = eventText.split("\n").find(function (line) { return line.indexOf("data: ") === 0; });
            if (!dataLine) return;
            var data = JSON.parse(dataLine.slice(6));
            if (eventText.indexOf("event: result") === 0) constitutionResult = data;
            else if (data.text) {
              var assistantMessage = document.createElement("p");
              assistantMessage.className = "chat-message chat-message--assistant";
              assistantMessage.textContent = data.text;
              transcript.appendChild(assistantMessage);
            }
          });
        }
        if (constitutionResult && constitutionResult.primaryType) {
          resultPanel.classList.remove("is-waiting");
          resultPanel.classList.add("is-ready");
          resultPanel.innerHTML = "<span class=\"result-card__label\">体质检测结果</span><div class=\"result-card__panel\"><p class=\"result-card__type\">" + escapeText(constitutionResult.primaryType) + "</p><h3>这是基于当前对话的初步方向</h3><p class=\"result-card__summary\">" + escapeText((constitutionResult.evidence || []).join(" ")) + "</p><p class=\"result-card__summary\"><strong>调养：</strong>" + escapeText((constitutionResult.guidance || []).join(" ")) + "</p><p class=\"result-card__summary\">" + escapeText(constitutionResult.safetyNotice) + "</p><a class=\"button button--primary\" href=\"./products.html\">查看对应产品</a></div>";
        }
      } catch (error) {
        var errorMessage = document.createElement("p");
        errorMessage.className = "chat-message chat-message--assistant";
        errorMessage.textContent = error.message;
        transcript.appendChild(errorMessage);
      } finally {
        input.disabled = false;
        input.focus();
      }
    }, { capture: true });
  }

  async function boot() {
    try { renderCart(await request("/cart")); } catch (error) {}
    try { await syncProducts(); } catch (error) {}
    try { await syncMedia(); } catch (error) {}
    try { await syncCheckout(); } catch (error) {}
    try { await syncOrderConfirmation(); } catch (error) {}
    try { await syncProductDetail(); } catch (error) {}
    try { await setupChat(); } catch (error) {}
  }

  boot();
}());
