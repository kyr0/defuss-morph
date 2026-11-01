import { reactive } from "defuss-morph";
import { add, cart, esc, reverse, total } from "./cart";

// an HTML string carries no handlers: one listener on the container
// serves every button and survives every re-render
export function mountCartHtml(app: HTMLElement) {
  app.addEventListener("click", (event) => {
    const button = (event.target as Element).closest("button");
    if (button?.dataset.add) add(button.dataset.add);
    if (button?.dataset.action === "reverse") reverse();
  });

  return reactive({
    store: cart,
    render: () => `
      <ol class="dm-cart">${cart.value.items.map((item) => `
        <li key="${item.id}">${esc(item.name)} × ${item.qty}
          <button type="button" class="btn" data-size="sm" data-add="${item.id}">+1</button></li>`).join("")}
      </ol>
      <p>${total()} items <button type="button" class="btn" data-variant="outline" data-size="sm" data-action="reverse">Reverse</button></p>`,
  }, app);
}
