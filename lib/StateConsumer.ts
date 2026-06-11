import { v7 as uuid } from 'uuid';
import type { StateCallback } from './StateCallback';
import type { StateEventTarget } from './StateEventTarget';

export class StateConsumer<
  StateDescriptor,
  State,
  Action,
  Engine extends StateEventTarget<StateDescriptor, State, Action> =
    StateEventTarget<StateDescriptor, State, Action>,
> {
  #engine;
  #id = uuid();
  #descriptor;
  #callback;
  #hasState = false;
  #state: State | undefined;
  #controller = new AbortController();

  constructor(
    engine: Engine,
    descriptor: StateDescriptor,
    callback: StateCallback<State>,
  ) {
    this.#engine = engine;
    this.#descriptor = descriptor;
    this.#callback = callback;

    const signal = this.signal;

    this.engine.addEventListener(
      'state',
      (event) => {
        if (
          !event.consumers.includes(this.id) ||
          (this.#hasState && this.compareStates(event.state, this.state!))
        )
          return;

        this.#hasState = true;
        this.#state = event.state;
        this.onState(event.state);
      },
      { signal },
    );

    this.engine.subscribeState(this.id, this.descriptor);

    signal.addEventListener('abort', () => {
      this.engine.unsubscribeState(this.id, this.descriptor);
    });
  }

  get engine(): Engine {
    return this.#engine;
  }

  get id(): string {
    return this.#id;
  }

  get descriptor(): StateDescriptor {
    return this.#descriptor;
  }

  get state(): State | undefined {
    return this.#state;
  }

  get signal(): AbortSignal {
    return this.#controller.signal;
  }

  protected compareStates(nextState: State, prevState: State): boolean {
    return nextState === prevState;
  }

  protected onState(state: State): void {
    this.#callback(state);
  }

  stop(): void {
    this.#controller.abort();
  }
}
