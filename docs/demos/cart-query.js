import df$ from "defuss-query";
import { installReactive } from "defuss-morph";
import { cart, total } from "./cart";

// adds .reactive() to every selection
installReactive(df$);

// the markup is already in the page: <p data-ref="cart-total"></p>
export const mountCartQuery = () =>
  df$("[data-ref=cart-total]").reactive({
    store: cart,
    render: () => `<strong>${total()}</strong> items in total`,
  });
