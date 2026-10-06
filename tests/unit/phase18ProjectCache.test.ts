import { describe, expect, it } from 'vitest';
import { createProjectCommandCache } from '../../src/app/features/projects/services/projectCommandCache';
import { registerAuthCacheReset, resetAuthCaches } from '../../src/app/shared/authCacheReset';

describe('project command cache authority isolation', () => {
  it('invalidates same-user logout/login snapshots and prior in-flight responses', () => {
    const cache = createProjectCommandCache<string>();
    const prior = cache.selectScope('alice:office-a:head');
    cache.set(prior, 'project', 'Prior session');
    const unregister = registerAuthCacheReset(() => cache.reset());
    resetAuthCaches();
    unregister();
    const current = cache.selectScope('alice:office-a:head');
    expect(cache.get(current, 'project')).toBeUndefined();
    cache.set(prior, 'project', 'Late prior session');
    expect(cache.get(current, 'project')).toBeUndefined();
  });
  it('retains same-actor project revisits but clears records across logout/login identities', () => {
    const cache = createProjectCommandCache<{ evidence: string }>();
    const alice = cache.selectScope('alice:office-a:head');
    cache.set(alice, 'shared-project', { evidence: 'Alice only' });
    cache.selectScope('alice:office-a:head');
    expect(cache.get(alice, 'shared-project')?.evidence).toBe('Alice only');
    const bob = cache.selectScope('bob:office-a:member');
    expect(cache.get(bob, 'shared-project')).toBeUndefined();
    expect(cache.get(alice, 'shared-project')).toBeUndefined();
    const returningAlice = cache.selectScope('alice:office-a:head');
    expect(cache.get(returningAlice, 'shared-project')).toBeUndefined();
    cache.set(alice, 'shared-project', { evidence: 'Prior session response' });
    expect(cache.get(returningAlice, 'shared-project')).toBeUndefined();
  });

  it('isolates Office and role changes even when project and task identities are unchanged', () => {
    const cache = createProjectCommandCache<string>();
    const head = cache.selectScope('alice:office-a:head');
    cache.set(head, 'shared-project', 'Head facts');
    const officeB = cache.selectScope('alice:office-b:head');
    expect(cache.get(officeB, 'shared-project')).toBeUndefined();
    cache.set(officeB, 'shared-project', 'Office B facts');
    const member = cache.selectScope('alice:office-b:member');
    expect(cache.get(member, 'shared-project')).toBeUndefined();
  });

  it('rejects a prior actor response after the new scope has loaded', () => {
    const cache = createProjectCommandCache<string>();
    const alice = cache.selectScope('alice:office-a:head');
    const bob = cache.selectScope('bob:office-a:member');
    cache.set(bob, 'project', 'Bob facts');
    cache.set(alice, 'project', 'Late Alice response');
    expect(cache.get(bob, 'project')).toBe('Bob facts');
    expect(cache.get(alice, 'project')).toBeUndefined();
  });
});

describe('authenticated cache cleanup', () => {
  it('unregisters inactive caches', () => {
    let resets = 0;
    const unregister = registerAuthCacheReset(() => { resets++; });
    resetAuthCaches();
    unregister();
    resetAuthCaches();
    expect(resets).toBe(1);
  });
  it('continues cleanup when another cache fails', () => {
    const failing = registerAuthCacheReset(() => { throw new Error('Cache cleanup interrupted'); });
    let cleaned = false;
    const working = registerAuthCacheReset(() => { cleaned = true; });
    expect(() => resetAuthCaches()).not.toThrow();
    expect(cleaned).toBe(true);
    failing();
    working();
  });
});
