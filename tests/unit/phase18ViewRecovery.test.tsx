// @vitest-environment jsdom
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {lazyFeature} from '../../src/app/shared/lazyFeature';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('retries failed view code without disclosing loader errors or changing route',async()=>{
 vi.spyOn(console,'error').mockImplementation(()=>{});
 const loaded=({title}:{title:string})=><button>{title}</button>;
 const loader=vi.fn().mockRejectedValueOnce(new Error('private transport details')).mockResolvedValue({default:loaded});
 const View=lazyFeature<typeof loaded>(loader);
 const route=location.href;render(<View title="Project table"/>);
 expect(await screen.findByRole('alert')).toBeTruthy();expect(screen.queryByText(/private transport/)).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Retry loading view'}));
 expect(await screen.findByRole('button',{name:'Project table'})).toBeTruthy();
 expect(loader).toHaveBeenCalledTimes(2);expect(location.href).toBe(route);
});
