import { Reactive, type Ref, createRef, morph } from "defuss-morph";
import { createStore } from "defuss-store";

const createStepper = () => {
  const count = createStore({ n: 0 });
  return {
    count,
    increment: () => count.set("n", count.value.n + 1),
    reset: () => count.set("n", 0),
  };
};

// what Stepper offers to a parent that holds its ref
export type StepperApi = ReturnType<typeof createStepper>;

// forwardRef pattern: an optional ref prop with a default. The component puts
// its API on ref.state, so a parent that passes the ref can call it; the state
// lives there too and outlives a re-render of that parent.
const Stepper = ({ label, ref = createRef<HTMLElement, StepperApi>() }: { label: string; ref?: Ref<HTMLElement, StepperApi> }) => {
  const api = (ref.state ??= createStepper());
  return (
    <Reactive ref={ref} class="dm-stepper" store={api.count} render={() => (
      <>
        <span>{label}: <output>{api.count.value.n}</output></span>
        <button type="button" class="btn" data-size="sm" onClick={api.increment}>+1</button>
      </>
    )} />
  );
};

const steps = createRef<HTMLElement, StepperApi>();

export const mountForwardRef = (app: HTMLElement) =>
  morph(app, (
    <div class="dm-stack">
      <Stepper label="Steps" ref={steps} />
      <Stepper label="On its own" />
      <button type="button" class="btn" data-variant="outline" onClick={() => steps.state?.reset()}>Reset Steps from the parent</button>
    </div>
  ));
