import { promptManager, main, PromptTrackingId } from '../index';

jest.mock('@autoblocks/client');
jest.setTimeout(30000);

describe('main', () => {
  it('builds prompts for feature A', async () => {
    await main();

    promptManager.snapshots(PromptTrackingId.A).forEach((snapshot) => {
      expect(snapshot).toMatchSnapshot();
    });
  });

  it('builds prompts for feature B', async () => {
    await main();

    promptManager.snapshots(PromptTrackingId.B).forEach((snapshot) => {
      expect(snapshot).toMatchSnapshot();
    });
  });
});
