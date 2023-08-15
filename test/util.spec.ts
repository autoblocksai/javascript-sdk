import { HeadersBuilder } from '../src/util';

describe('Headers Builder', () => {
  it('getLocalCommitData', async () => {
    const builder = new HeadersBuilder();
    const commit = builder.getLocalCommitData({ sha: null });

    expect(commit.sha.length).toEqual(40);
    expect(commit.message.length).toBeGreaterThan(0);
    expect(commit.committerName.length).toBeGreaterThan(0);
    expect(commit.authorName.length).toBeGreaterThan(0);
    expect(commit.authorEmail.includes('@')).toBe(true);
    expect(commit.committerEmail.includes('@')).toBe(true);
    expect(commit.committedDate.length).toBeGreaterThan(0);
  });

  it('getLocalBranchName', async () => {
    const builder = new HeadersBuilder();
    const branchName = builder.getLocalBranchName();
    expect(branchName?.length).toBeGreaterThan(0);
  });

  it('getLocalRepoName', async () => {
    const builder = new HeadersBuilder();
    const repoName = builder.getLocalRepoName();
    expect(repoName).toEqual('autoblocksai/javascript-sdk');
  });
});
