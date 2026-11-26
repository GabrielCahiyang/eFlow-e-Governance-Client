import {beforeEach,describe,expect,it,vi} from 'vitest';

const mock=vi.hoisted(()=>({setSession:vi.fn(),rpc:vi.fn()}));
vi.mock('../../src/lib/supabase',()=>({supabase:{auth:{setSession:mock.setSession},rpc:mock.rpc}}));
import {signInWithAccountProtection} from '../../src/app/features/authentication/services/accountLogin';

beforeEach(()=>{
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.stubEnv('VITE_SUPABASE_URL','https://project.supabase.co/');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY','anon-public-key');
  mock.setSession.mockReset().mockResolvedValue({error:null});
  mock.rpc.mockReset();
});

describe('server-owned account sign-in via Supabase web-sign-in edge function',()=>{
  it('posts directly to Supabase web-sign-in without calling the AI tunnel RPC',async()=>{
    const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({access_token:'test-token',refresh_token:'test-refresh'})));
    vi.stubGlobal('fetch',fetch);
    await signInWithAccountProtection(' person@example.test ','password');
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(fetch.mock.calls[0][0]).toBe('https://project.supabase.co/functions/v1/web-sign-in');
    expect(fetch.mock.calls[0][1].headers).toEqual({
      'Content-Type':'application/json',
      apikey:'anon-public-key',
    });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({email:'person@example.test',password:'password'});
    expect(fetch.mock.calls[0][1].cache).toBe('no-store');
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(false);
    expect(mock.setSession).toHaveBeenCalledWith({access_token:'test-token',refresh_token:'test-refresh'});
  });

  it('fails closed when Supabase environment variables are missing',async()=>{
    vi.stubEnv('VITE_SUPABASE_URL','');
    const fetch=vi.fn();
    vi.stubGlobal('fetch',fetch);
    await expect(signInWithAccountProtection('person@example.test','password')).rejects.toThrow('secure sign-in service is unavailable');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([401,423,429,503])('does not create a session or retry rejected status %s',async status=>{
    const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({detail:'private provider error'}),{status}));
    vi.stubGlobal('fetch',fetch);
    await expect(signInWithAccountProtection('person@example.test','password')).rejects.toMatchObject({status});
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(mock.setSession).not.toHaveBeenCalled();
  });

  it('handles non-JSON upstream error pages without crashing',async()=>{
    const fetch=vi.fn().mockResolvedValue(new Response('<html>503</html>',{status:503}));
    vi.stubGlobal('fetch',fetch);
    await expect(signInWithAccountProtection('person@example.test','password')).rejects.toMatchObject({
      status:503,
      message:'Unable to sign in right now. Please try again shortly.',
    });
    expect(mock.setSession).not.toHaveBeenCalled();
  });

  it('does not replay a password when a response is lost',async()=>{
    const fetch=vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch',fetch);
    await expect(signInWithAccountProtection('person@example.test','password')).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects a malformed successful response',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}')));
    await expect(signInWithAccountProtection('person@example.test','password')).rejects.toThrow('Unable to finish');
    expect(mock.setSession).not.toHaveBeenCalled();
  });

  it('forwards the active portal when specified',async()=>{
    const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({access_token:'test-token',refresh_token:'test-refresh'})));
    vi.stubGlobal('fetch',fetch);
    await signInWithAccountProtection('admin@example.test','password','admin');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({email:'admin@example.test',password:'password',portal:'admin'});
  });
});
