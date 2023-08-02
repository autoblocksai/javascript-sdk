import { hello } from '../src/index';

describe('index', () => {
  it('hello', () => {
    expect(hello()).toEqual('world');
  });
});
