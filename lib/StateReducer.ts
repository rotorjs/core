import { stateInterest, stateReducerCleanupInterest } from './interests';
import type { StateEngine } from './StateEngine';

export abstract class StateReducer<
  StateDescriptor,
  State,
  Action,
  Engine extends StateEngine<StateDescriptor, State, Action> = StateEngine<
    StateDescriptor,
    State,
    Action
  >,
> {
  #engine;
  #id;
  #descriptor;
  #consumers: { [id: string]: boolean } = {};
  #interests: { [interest: string]: boolean } = {};
  #hasState = false;
  #state: State | undefined;
  #debounce = 0;
  #pending = false;
  #queue = Promise.resolve();
  #controller = new AbortController();

  constructor(engine: Engine, descriptor: StateDescriptor) {
    this.#engine = engine;
    this.#id = this.engine.getReducerID(descriptor);
    this.#descriptor = descriptor;

    const signal = this.signal;

    this.target.addEventListener(
      'interest',
      (event) => {
        if (this.hasInterest(event.interest)) this.update();
      },
      { signal },
    );
  }

  get engine(): Engine {
    return this.#engine;
  }

  get target(): Engine['target'] {
    return this.engine.target;
  }

  get id(): string {
    return this.#id;
  }

  get descriptor(): StateDescriptor {
    return this.#descriptor;
  }

  get debounce(): number {
    return this.#debounce;
  }

  get signal(): AbortSignal {
    return AbortSignal.any([this.#controller.signal, this.engine.signal]);
  }

  addConsumer(consumer: string): void {
    this.#consumers[consumer] = true;

    if (!this.signal.aborted && this.#hasState)
      setTimeout(() => {
        if (this.hasConsumer(consumer))
          this.target.dispatchState([consumer], this.#state!);
      });
  }

  hasConsumer(consumer: string): boolean {
    return Object.hasOwn(this.#consumers, consumer);
  }

  getConsumers(): string[] {
    return Object.keys(this.#consumers);
  }

  removeConsumer(consumer: string): boolean {
    return delete this.#consumers[consumer];
  }

  clearConsumers(): void {
    this.#consumers = {};
  }

  addInterest(interest: string): void {
    this.#interests[interest] = true;
  }

  hasInterest(interest: string): boolean {
    return Object.hasOwn(this.#interests, interest);
  }

  getInterests(): string[] {
    return Object.keys(this.#interests);
  }

  removeInterest(interest: string): boolean {
    return delete this.#interests[interest];
  }

  clearInterests(): void {
    this.#interests = {};
  }

  setDebounce(debounce: number): void {
    this.#debounce = debounce;
  }

  update(): void {
    if (this.#pending) return;

    this.#pending = true;

    this.#queue = this.#queue
      .then<void>(async () => {
        await new Promise((resolve) => {
          // The timeout is needed to allow other events to be processed between updates.
          // Also, we can set an optional debounce here to reduce unnecessary redundant updates.
          setTimeout(resolve, this.#debounce);
        });

        this.#pending = false;

        if (this.signal.aborted) return;

        let nextState: State;
        try {
          nextState = await this.reduce(this.#state);
        } catch (error) {
          nextState = this.recover(this.#state, error);
        }

        this.target.dispatchInterest(stateReducerCleanupInterest(this.id));

        if (
          this.signal.aborted ||
          (this.#hasState && this.compareStates(nextState, this.#state!))
        )
          return;

        this.#hasState = true;
        this.#state = nextState;
        this.onState(nextState);
      })
      .catch((error) => {
        // make sure the queue stays operational by relaying the error into a new unhandled rejected Promise which is picked up by the "unhandledrejection" event
        Promise.reject(error);
      });
  }

  abstract reduce(prevState: State | undefined): State | Promise<State>;

  abstract recover(prevState: State | undefined, error: unknown): State;

  protected compareStates(nextState: State, prevState: State): boolean {
    return nextState === prevState;
  }

  protected onState(state: State): void {
    setTimeout(() => {
      this.target.dispatchState(this.getConsumers(), state);
      this.target.dispatchInterest(stateInterest(this.id));
    });
  }

  stop(): void {
    this.#controller.abort();
  }
}
