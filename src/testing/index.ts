export { runTestSuite } from './run';
export {
  BaseTestEvaluator,
  BaseEventEvaluator,
  BaseEvaluator,
  type Threshold,
  type Evaluation,
  type TracerEvent,
} from './models';
export {
  BaseHasAllSubstrings,
  // deprecated
  BaseHasAllSubstrings as HasAllSubstrings,
} from './evaluators/has-all-substrings';
export {
  BaseAutomaticBattle,
  BaseManualBattle,
  // deprecated
  BaseAutomaticBattle as AutomaticBattle,
  BaseManualBattle as ManualBattle,
} from './evaluators/battle';
