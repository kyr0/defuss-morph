// e2e consumer (TypeScript + JSX): `make e2e` type-checks this file in the clean project against the packed
// tarball's declarations, with jsxImportSource "defuss-morph", the way a TSX user's project compiles it.
// VERIFIED: it passes with tsc (NodeNext) against the installed tarball; a separate jsx-runtime build entry would
// have shipped a second declaration chunk, which this check would compile against instead.
import { Reactive, type Ref, createRef, morph } from "defuss-morph";
import { createStore } from "defuss-store";

const counter = createStore({ n: 0 });

type StepperApi = { reset(): void };

const Row = ({ name }: { name: string }) => <li>{name}</li>;

const Stepper = ({ ref = createRef<HTMLElement, StepperApi>() }: { ref?: Ref<HTMLElement, StepperApi> }) => {
  ref.state = { reset: () => counter.set("n", 0) };
  return (
    <Reactive ref={ref} tag="section" store={counter} render={() => (
      <>
        <ul>{["a", "b"].map((name) => <Row key={name} name={name} />)}</ul>
        <button type="button" onClick={() => counter.set("n", counter.value.n + 1)}>{counter.value.n}</button>
      </>
    )} />
  );
};

const stepper = createRef<HTMLElement, StepperApi>();
export const mount = (app: HTMLElement) => {
  morph(app, <Stepper ref={stepper} />);
  stepper.state?.reset();
};
