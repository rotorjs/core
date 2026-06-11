import { StateEngine, StateReducer, type StateEventTarget } from '@/main';

export type DemoStateDescriptor = { other: boolean };

export type DemoState =
  | 'demo state'
  | 'other demo state'
  | `extended demo state ${string}`;

export type DemoAction = 'demo action' | 'stop';

export type DemoStateEventTarget = StateEventTarget<
  DemoStateDescriptor,
  DemoState,
  DemoAction
>;

export class DemoStateReducer extends StateReducer<
  DemoStateDescriptor,
  DemoState,
  DemoAction,
  DemoStateEngine
> {
  #other: boolean;

  constructor(engine: DemoStateEngine, descriptor: DemoStateDescriptor) {
    super(engine, descriptor);

    this.#other = descriptor.other;

    this.update();
  }

  async reduce(): Promise<DemoState> {
    console.log('reduce');

    this.clearInterests();

    this.target.dispatchAction('demo action');

    this.addInterest('demo interest');

    return this.engine.getState(this.#other);
  }

  recover(_prevState: DemoState, error: unknown): DemoState {
    throw error;
  }
}

export class DemoStateEngine extends StateEngine<
  DemoStateDescriptor,
  DemoState,
  DemoAction
> {
  protected onAction(action: DemoAction): void {
    super.onAction(action);

    switch (action) {
      case 'demo action':
        console.log('got demo action');

        setTimeout(() => {
          this.target.dispatchInterest('demo interest');
        }, 5000);
        return;
    }
  }

  getState(other: boolean): DemoState {
    return other ? 'other demo state' : 'demo state';
  }

  getReducerID(descriptor: DemoStateDescriptor): string {
    return descriptor.other ? 'other reducer' : 'reducer';
  }

  protected createReducer(
    descriptor: DemoStateDescriptor,
  ): StateReducer<DemoStateDescriptor, DemoState, 'demo action' | 'stop'> {
    console.log('creating reducer:', this.getReducerID(descriptor));
    return new DemoStateReducer(this, descriptor);
  }
}

export class ExtendedDemoStateEngine extends DemoStateEngine {
  #n = 0;

  getState(other: boolean): DemoState {
    if (other) return super.getState(other);
    return `extended demo state ${this.#n++}`;
  }
}
