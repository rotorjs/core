import { v7 as uuid } from 'uuid';
import type { StateCallback } from './StateCallback';
import type { StateEventTarget } from './StateEventTarget';

export class StateConsumer<
  StateDescriptor,
  State,
  Action,
  Target extends StateEventTarget<StateDescriptor, State, Action> =
    StateEventTarget<StateDescriptor, State, Action>,
> {
  #target;
  #id = uuid();
  #descriptor;
  #callback;
  #hasState = false;
  #state: State | undefined;
  #controller = new AbortController();

  constructor(
    target: Target,
    descriptor: StateDescriptor,
    callback: StateCallback<State>,
  ) {
    this.#target = target;
    this.#descriptor = descriptor;
    this.#callback = callback;

    const signal = this.signal;

    this.target.addEventListener(
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

    this.target.subscribeState(this.id, this.descriptor);

    signal.addEventListener('abort', () => {
      this.target.unsubscribeState(this.id, this.descriptor);
    });
  }

  get target(): Target {
    return this.#target;
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
