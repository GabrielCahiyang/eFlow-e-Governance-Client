// @vitest-environment jsdom
import {afterEach, expect, it, vi} from 'vitest';
import {retryViewModule} from '../../src/app/shared/retryViewModule';
afterEach(()=>vi.unstubAllGlobals());
it.each(['../private.js','https://outside.example/code.js','assets/code.js?token=private',null])('rejects an invalid recovery asset %s before importing it',async file=>{
  const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({TaskInspector:file})});
  vi.stubGlobal('fetch',fetch);
  await expect(retryViewModule('TaskInspector')).rejects.toThrow('View download unavailable.');
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][1]).toEqual({cache:'no-store'});
});
