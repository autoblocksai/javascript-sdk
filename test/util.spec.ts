import { HeadersBuilder, parseRepoNameFromOriginUrl } from '../src/util';

describe('Headers Builder', () => {
  it('getLocalCommitData', async () => {
    const builder = new HeadersBuilder();
    const commit = builder.getLocalCommitData({ sha: null });

    expect(commit.sha.length).toEqual(40);
    expect(commit.message.length).toBeGreaterThan(0);
    expect(commit.message.includes('\n')).toBe(false);
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

  describe('parseRepoNameFromOriginUrl', () => {
    it('parses HTTPS urls (GitHub)', () => {
      expect(
        parseRepoNameFromOriginUrl(
          'https://github.com/autoblocksai/neon-actions.git',
        ),
      ).toEqual('autoblocksai/neon-actions');
    });

    it('parses HTTPS urls (GitLab)', () => {
      expect(
        parseRepoNameFromOriginUrl(
          'https://gitlab.com/gitlab-com/www-gitlab-com.git',
        ),
      ).toEqual('gitlab-com/www-gitlab-com');
    });

    it('parses SSH URLs (GitHub)', () => {
      expect(
        parseRepoNameFromOriginUrl(
          'git@github.com:autoblocksai/neon-actions.git',
        ),
      ).toEqual('autoblocksai/neon-actions');
    });

    it('parses SSH URLs (GitLab)', () => {
      expect(
        parseRepoNameFromOriginUrl(
          'git@gitlab.com:gitlab-com/www-gitlab-com.git',
        ),
      ).toEqual('gitlab-com/www-gitlab-com');
    });
  });
});
