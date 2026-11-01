import { Reactive, morph } from "defuss-morph";
import { add, cart } from "./cart";

// <Reactive> renders its children again on every store change; keyed rows
// move together with the note typed into them
const CartList = () => (
  <Reactive tag="ul" class="dm-cart" store={cart} render={() =>
    cart.value.items.map((item) => (
      <li key={item.id}>
        <span>{item.name} × {item.qty}</span>
        <input class="input" data-size="sm" placeholder="note" aria-label={`${item.name} note`} />
        <button type="button" class="btn" data-size="sm" onClick={() => add(item.id)}>+1</button>
      </li>
    ))
  } />
);

export const mountCartJsx = (app: HTMLElement) => morph(app, <CartList />);
