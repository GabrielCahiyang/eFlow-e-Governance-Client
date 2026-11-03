// @vitest-environment jsdom
import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {liquidationStage} from '../../src/app/features/budget/selectors/liquidationStage';
import {LiquidationStageNotice} from '../../src/app/features/budget/components/LiquidationStageNotice';
import {cashData,cashRequest} from './taskCashClearance.fixtures';
afterEach(cleanup);
it('keeps receipt approval separate from settlement until the cash request is actually settled',()=>{
 const request=cashRequest(),item={...cashData().liquidations[0],leaderDecidedAt:100};
 expect(liquidationStage(request,item)).toMatchObject({tone:'pending',title:'Receipts approved · awaiting Accounting settlement'});
 render(<LiquidationStageNotice request={request} liquidation={item}/>);
 expect(screen.getByRole('status').textContent).toContain('Accounting still needs to settle and post');
 expect(liquidationStage({...request,status:'settled'}, {...item,status:'approved'})).toMatchObject({tone:'success',title:'Settled'});
});
it('flags an inconsistent approved liquidation without pretending the open advance has cleared',()=>{
 const request=cashRequest(),item={...cashData().liquidations[0],status:'approved' as const};
 render(<LiquidationStageNotice request={request} liquidation={item}/>);
 expect(screen.getByRole('alert').textContent).toContain('cash request is still open');
});
it('does not invent a receipt decision before endorsement',()=>{
 expect(liquidationStage(cashRequest({status:'released'}))).toBeNull();
 expect(liquidationStage(cashRequest())).toMatchObject({title:'Awaiting Accounting settlement'});
});
