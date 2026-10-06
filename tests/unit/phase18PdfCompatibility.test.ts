import {beforeEach,expect,it,vi} from 'vitest';
import {extractTextFromPdf} from '../../src/app/features/proposal-import/services/pdfTextExtractor';
const api=vi.hoisted(()=>({getDocument:vi.fn(),worker:{workerSrc:''}}));
vi.mock('pdfjs-dist',()=>({getDocument:api.getDocument,GlobalWorkerOptions:api.worker}));
beforeEach(()=>vi.clearAllMocks());
it('extracts all text chunks without requiring async stream iteration and releases resources',async()=>{
 const releaseLock=vi.fn(),destroy=vi.fn();let pageNumber=0;
 api.getDocument.mockReturnValue({promise:Promise.resolve({numPages:2,destroy,getPage:async()=>{pageNumber++;let index=0;const chunks=pageNumber===1?[{items:[{str:'Office'},{str:'plan'}]},{items:[{str:'review'}]}]:[{items:[{str:'Next page'}]}];return {streamTextContent:()=>({getReader:()=>({read:async()=>index<chunks.length?{done:false,value:chunks[index++]}:{done:true},releaseLock})})};}})});
 expect(await extractTextFromPdf({arrayBuffer:async()=>new ArrayBuffer(1)} as File)).toBe('Office plan review\n\nNext page');
 expect(releaseLock).toHaveBeenCalledTimes(2);expect(destroy).toHaveBeenCalledOnce();
});
it('propagates read failures while releasing the reader and PDF worker',async()=>{
 const releaseLock=vi.fn(),destroy=vi.fn();
 api.getDocument.mockReturnValue({promise:Promise.resolve({numPages:1,destroy,getPage:async()=>({streamTextContent:()=>({getReader:()=>({read:async()=>{throw new Error('Synthetic read failure')},releaseLock})})})})});
 await expect(extractTextFromPdf({arrayBuffer:async()=>new ArrayBuffer(1)} as File)).rejects.toThrow('Synthetic read failure');
 expect(releaseLock).toHaveBeenCalledOnce();expect(destroy).toHaveBeenCalledOnce();
});
