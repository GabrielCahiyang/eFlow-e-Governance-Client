import {beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({setSession:vi.fn(),base:vi.fn(),rpc:vi.fn()}));
vi.mock('../../src/lib/supabase',()=>({supabase:{auth:{setSession:mock.setSession},rpc:mock.rpc}}));
vi.mock('../../src/app/shared/controlPanelClient',()=>({resolveControlPanelBase:mock.base,normalizeControlPanelBase:(value:string)=>value}));
import {signInWithAccountProtection} from '../../src/app/features/authentication/services/accountLogin';
beforeEach(()=>{vi.unstubAllGlobals();mock.base.mockResolvedValue('/controlpanelEflow/api');mock.setSession.mockReset().mockResolvedValue({error:null});});
describe('server-owned account sign-in',()=>{
  it('discovers only the public gateway address when private settings are unavailable',async()=>{
    mock.base.mockRejectedValueOnce(new Error('Unavailable'));
    mock.rpc.mockResolvedValueOnce({data:'https://gateway.example.test/controlpanelEflow/api',error:null});
    const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({access_token:'test-token',refresh_token:'test-refresh'})));
    vi.stubGlobal('fetch',fetch);
    await signInWithAccountProtection('person@example.test','password');
    expect(mock.rpc).toHaveBeenCalledWith('eflow_login_gateway_endpoint');
    expect(fetch.mock.calls[0][0]).toBe('https://gateway.example.test/controlpanelEflow/api/auth/login');
  });
  it('sends only credentials, then attaches the verified user session',async()=>{
    const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({access_token:'test-token',refresh_token:'test-refresh'})));
    vi.stubGlobal('fetch',fetch);
    await signInWithAccountProtection(' person@example.test ','password');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({email:'person@example.test',password:'password'});
    expect(fetch.mock.calls[0][0]).toBe('/controlpanelEflow/api/auth/login');
    expect(mock.setSession).toHaveBeenCalledWith({access_token:'test-token',refresh_token:'test-refresh'});
  });
  it.each([401,423,429,503])('does not create a session or retry rejected status %s',async status=>{
    const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({detail:'private provider error'}),{status}));
    vi.stubGlobal('fetch',fetch);
    await expect(signInWithAccountProtection('person@example.test','password')).rejects.toMatchObject({status});
    expect(fetch).toHaveBeenCalledTimes(1); expect(mock.setSession).not.toHaveBeenCalled();
  });
  it('does not replay a password when a response is lost',async()=>{
    const fetch=vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));vi.stubGlobal('fetch',fetch);
    await expect(signInWithAccountProtection('person@example.test','password')).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects a malformed successful response',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}')));
    await expect(signInWithAccountProtection('person@example.test','password')).rejects.toThrow('Unable to finish');
    expect(mock.setSession).not.toHaveBeenCalled();
  });
});
