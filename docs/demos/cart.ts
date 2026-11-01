import { createStore } from "defuss-store";

export interface Item {
  id: string;
  name: string;
  qty: number;
}

// one store; the three views next to it re-render whenever it changes
export const cart = createStore<{ items: Item[] }>({
  items: [
    { id: "tea", name: "Tea", qty: 1 },
    { id: "milk", name: "Milk", qty: 2 },
    { id: "bread", name: "Bread", qty: 1 },
  ],
});

export const add = (id: string) =>
  cart.update(({ items }) => ({
    items: items.map((item) => (item.id === id ? { ...item, qty: item.qty + 1 } : item)),
  }));

export const reverse = () => cart.update(({ items }) => ({ items: [...items].reverse() }));

export const total = () => cart.value.items.reduce((sum, item) => sum + item.qty, 0);

// text that goes into an HTML string is escaped
export const esc = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
