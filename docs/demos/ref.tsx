import { createRef, morph } from "defuss-morph";

// morph puts the element that carries ref={field} into field.current,
// and a morph that keeps the element keeps the ref pointing at it
const field = createRef<HTMLInputElement>();

const Search = ({ renders, onRender }: { renders: number; onRender: () => void }) => (
  <form class="dm-row" onSubmit={(event: Event) => event.preventDefault()}>
    <input ref={field} class="input" name="q" placeholder="Type, then render again" aria-label="Search" />
    <button type="button" class="btn" data-variant="outline" onClick={() => field.current?.focus()}>Focus via ref</button>
    <button type="button" class="btn" onClick={onRender}>Render again</button>
    <output>{renders === 1 ? "1 render" : `${renders} renders`}</output>
  </form>
);

export function mountRef(app: HTMLElement) {
  let renders = 0;
  const render = () => morph(app, <Search renders={++renders} onRender={render} />);
  render();
}
