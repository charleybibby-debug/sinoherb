(function () {
  "use strict";

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
    if (items) {
      items.innerHTML = cart.items.length ? cart.items.map(function (item) {
        return "<article class=\"checkout-summary__item\"><div class=\"checkout-summary__line\"><strong>" + escapeText(item.product.name) + " × " + item.quantity + "</strong><span>" + escapeText(item.lineTotal) + "</span></div><p>" + escapeText(item.product.category) + " · " + escapeText(item.product.constitutionType) + "</p></article>";
      }).join("") : "<p>购物车为空，请先选择产品。</p>";
    }
    if (total) total.textContent = cart.subtotal;
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      var data = new FormData(form);
      var message = document.querySelector("#checkoutMessage");
      try {
        var order = await request("/orders", {
          method: "POST",
          body: JSON.stringify({
            name: String(data.get("firstName") || "") + " " + String(data.get("lastName") || ""),
            phone: data.get("phone"),
            email: data.get("email"),
            address: data.get("address"),
            notes: data.get("notes"),
          }),
        });
        if (message) message.textContent = "订单 " + order.orderNumber + " 已提交，我们会联系你确认付款与配送。";
        form.reset();
      } catch (error) {
        if (message) message.textContent = error.message;
      }
    });
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
    try { await syncProductDetail(); } catch (error) {}
    try { await setupChat(); } catch (error) {}
  }

  boot();
}());
