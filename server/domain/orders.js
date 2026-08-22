const orderStatuses = ["pending_payment", "pending_contact", "contacted", "confirmed", "completed", "cancelled"];
const transitions = {
  pending_payment: ["pending_contact", "cancelled"],
  pending_contact: ["contacted", "cancelled"],
  contacted: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function calculateOrderLines(items, products) {
  const productMap = new Map(products.map((product) => [product.id, product]));
  return items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product || product.status !== "active") throw new Error("product unavailable");
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error("invalid quantity");
    if (product.stockQuantity < quantity) throw new Error("product out of stock");
    const unitPriceCents = product.priceCents;
    return {
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      unitPriceCents,
      quantity,
      lineTotalCents: unitPriceCents * quantity,
    };
  });
}

export function transitionOrderStatus(current, next) {
  if (!orderStatuses.includes(current) || !orderStatuses.includes(next)) throw new Error("invalid order status");
  if (current !== next && !transitions[current].includes(next)) throw new Error("invalid order transition");
  return next;
}
