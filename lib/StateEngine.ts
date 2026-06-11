import { StateEventTarget } from './StateEventTarget';
import type { StateReducer } from './StateReducer';

export abstract class StateEngine<
  StateDescriptor,
  State,
  Action,
  Target extends StateEventTarget<StateDescriptor, State, Action> =
    StateEventTarget<StateDescriptor, State, Action>,
> {
  #target;
  #reducers: {
    [id: string]: StateReducer<StateDescriptor, State, Action>;
  } = {};
  #controller = new AbortController();

  constructor(target: Target) {
    this.#target = target;

    const signal = this.signal;

    this.target.addEventListener(
      'action',
      (event) => {
        this.onAction(event.action);
      },
      { signal },
    );

    this.target.addEventListener(
      'subscribe-state',
      (event) => {
        const id = this.getReducerID(event.descriptor);

        if (!Object.hasOwn(this.#reducers, id)) {
          const reducer = this.createReducer(event.descriptor);
          this.#reducers[id] = reducer;
        }

        this.#reducers[id].addConsumer(event.consumer);
      },
      { signal },
    );

    this.target.addEventListener(
      'unsubscribe-state',
      (event) => {
        const id = this.getReducerID(event.descriptor);

        if (!Object.hasOwn(this.#reducers, id)) return;

        const reducer = this.#reducers[id];

        if (!reducer.removeConsumer(event.consumer)) return;

        if (!reducer.getConsumers().length) {
          setTimeout(() => {
            if (reducer.getConsumers().length || this.#reducers[id] !== reducer)
              return;

            delete this.#reducers[id];
            reducer.stop();
          });
        }
      },
      { signal },
    );
  }

  get target(): Target {
    return this.#target;
  }

  get signal(): AbortSignal {
    return this.#controller.signal;
  }

  abstract getReducerID(descriptor: StateDescriptor): string;

  protected abstract createReducer(
    descriptor: StateDescriptor,
  ): StateReducer<StateDescriptor, State, Action>;

  protected onAction(_action: Action): void {}

  stop(): void {
    this.#controller.abort();
  }
}
