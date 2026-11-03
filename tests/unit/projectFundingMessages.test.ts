import {expect,it} from 'vitest';
import {fundingEntryError,fundingErrorMessage} from '../../src/app/features/project-setup/fundingMessages';
const sources=[{id:'office',name:'Office supplies',year:2026,available:40000}];
it('explains the screenshot overbudget amount before asking for a missing reason',()=>{
 expect(fundingEntryError([{partitionId:'office',amount:40111}],sources,'')).toBe('Office supplies (FY 2026): You entered ₱40,111.00, but only ₱40,000.00 is available. Reduce it by ₱111.00.');
});
it('rejects repeated sources even if their combined amount fits',()=>{
 expect(fundingEntryError([{partitionId:'office',amount:10000},{partitionId:'office',amount:10000}],sources,'Supplies')).toBe('Use each budget source only once.');
});
it('accepts the exact available amount and explains missing fields separately',()=>{
 expect(fundingEntryError([{partitionId:'office',amount:40000}],sources,'Supplies')).toBe('');
 expect(fundingEntryError([{partitionId:'',amount:100}],sources,'')).toBe('Choose a budget source.');
 expect(fundingEntryError([{partitionId:'office',amount:0}],sources,'')).toBe('Enter an amount greater than zero.');
 expect(fundingEntryError([{partitionId:'office',amount:100}],sources,'')).toBe('Add a reason for this funding.');
});
it('simplifies stale-balance server errors without hiding other errors',()=>{
 expect(fundingErrorMessage(new Error('Office Budget has insufficient available funding'))).toBe('Not enough money left in the Office Budget.');
 expect(fundingErrorMessage(new Error('Funding source Supplies: requested 50000, available 40000'))).toBe('Supplies: You entered ₱50,000.00, but only ₱40,000.00 is available. Reduce it by ₱10,000.00.');
 expect(fundingErrorMessage(new Error('Access denied'))).toBe('Access denied');
});
