import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({session:vi.fn(),refresh:vi.fn(),config:vi.fn()}));
vi.mock('../../src/lib/supabase',()=>({supabase:{auth:{getSession:api.session,refreshSession:api.refresh}}}));
vi.mock('../../src/lib/supabaseService',()=>({fetchConfig:api.config}));
import {controlPanelFetch} from '../../src/app/shared/controlPanelClient';
import {SESSION_REFRESH_MESSAGE} from '../../src/app/shared/userFacingError';
beforeEach(()=>{
  vi.resetAllMocks();
  api.session.mockResolvedValue({data:{session:{access_token:'old-token',expires_at:Date.now()/1000+3600}},error:null});
  api.refresh.mockResolvedValue({data:{session:{access_token:'fresh-token'}},error:null});
  api.config.mockResolvedValue('https://gateway.example.test/controlpanelEflow/api');
});
afterEach(()=>vi.unstubAllGlobals());
it('retries a rejected 401 once with the refreshed token and preserves the request body',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(new Response('{}',{status:401})).mockResolvedValueOnce(new Response('{"status":"accepted"}'));
  vi.stubGlobal('fetch',fetch);
  const result=await controlPanelFetch('admin/example',{method:'POST',body:'{"request_id":"same-request"}'});
  expect(result.status).toBe(200);expect(fetch).toHaveBeenCalledTimes(2);expect(api.refresh).toHaveBeenCalledTimes(1);
  expect(new Headers(fetch.mock.calls[0][1].headers).get('Authorization')).toBe('Bearer old-token');
  expect(new Headers(fetch.mock.calls[1][1].headers).get('Authorization')).toBe('Bearer fresh-token');
  expect(fetch.mock.calls[1][1].body).toBe(fetch.mock.calls[0][1].body);
});
it('keeps a repeated authorization rejection as a session error without trying tunnel recovery',async()=>{
  const fetch=vi.fn().mockResolvedValue(new Response('{}',{status:401}));vi.stubGlobal('fetch',fetch);
  await expect(controlPanelFetch('admin/example')).rejects.toThrow(SESSION_REFRESH_MESSAGE);
  expect(fetch).toHaveBeenCalledTimes(2);expect(api.refresh).toHaveBeenCalledTimes(1);expect(api.config).toHaveBeenCalledTimes(1);
});
it('keeps refresh failure as a session error and does not replay the rejected request',async()=>{
  api.refresh.mockResolvedValue({data:{session:null},error:new Error('Provider unavailable')});
  const fetch=vi.fn().mockResolvedValue(new Response('{}',{status:401}));vi.stubGlobal('fetch',fetch);
  await expect(controlPanelFetch('admin/example')).rejects.toThrow(SESSION_REFRESH_MESSAGE);
  expect(fetch).toHaveBeenCalledTimes(1);expect(api.config).toHaveBeenCalledTimes(1);
});
