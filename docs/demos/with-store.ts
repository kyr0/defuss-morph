import { reactive } from "defuss-morph";
import { computed, createStore } from "defuss-store";
import { esc } from "./cart";

const profile = createStore({ name: "Ada", visits: 0 });

// a computed store notifies only when its result changes,
// so a visit does not re-render the greeting
const greeting = computed(profile, (value) => `Hello, ${value.name}`);

export function mountWithStore(app: HTMLElement) {
  const part = (name: string) => app.querySelector<HTMLElement>(`[data-ref=${name}]`)!;
  let renders = 0;
  reactive({ store: greeting, render: () => `${esc(greeting.value)} <small>(render ${++renders})</small>` }, part("greeting"));
  reactive({ store: profile, render: () => `${profile.value.visits} visits` }, part("visits"));

  part("visit").addEventListener("click", () => profile.set("visits", profile.value.visits + 1));
  part("rename").addEventListener("click", () => profile.set("name", profile.value.name === "Ada" ? "Grace" : "Ada"));
}
