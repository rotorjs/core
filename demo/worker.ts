import { wrapWorker, type StateEventTarget } from '../lib/main';
import {
  ExtendedDemoStateEngine,
  type DemoAction,
  type DemoState,
  type DemoStateDescriptor,
} from './DemoStateEngine';

const controller = new AbortController();
const signal = controller.signal;

const target: StateEventTarget<DemoStateDescriptor, DemoState, DemoAction> =
  wrapWorker(self, { signal });
const engine = new ExtendedDemoStateEngine(target);

target.addEventListener('action', (event) => {
  console.log('worker: action', event.action, event.emitter);

  if (event.action === 'stop') {
    engine.stop();
    controller.abort();
  }
});

target.addEventListener('interest', (event) => {
  console.log('worker: interest', event.interest, event.emitter);
});

target.addEventListener('subscribe-state', (event) => {
  console.log(
    'worker: subscribe state',
    event.consumer,
    event.descriptor,
    event.emitter,
  );
});

target.addEventListener('unsubscribe-state', (event) => {
  console.log(
    'worker: unsubscribe state',
    event.consumer,
    event.descriptor,
    event.emitter,
  );
});

target.addEventListener('state', (event) => {
  console.log('worker: state', event.consumers, event.state, event.emitter);
});
