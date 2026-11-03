import {test,expect} from '@playwright/test';
import {phase16FinancialFixture,phase16FinancialState} from './fixtures/phase16Financial';
// Intercepted browser responses only. Does not modify the hosted demo request.
test('Accounting-owned cash explains both missing independent assignments',async({page},info)=>{
 test.setTimeout(100000);await page.setViewportSize({width:1440,height:1000});
 const state=phase16FinancialState();state.requests[0].requester_id='00000000-0000-4000-8000-000000000001';state.requests[0].cash_recipient_id='00000000-0000-4000-8000-000000000001';
 await phase16FinancialFixture(page,'accounting_staff',state);
 await page.route('**/rest/v1/rpc/get_liquidation_independent_review',route=>route.fulfill({json:{liquidationId:state.liquidations[0].id,version:2,required:true,current:false,canReview:false,canSettle:false,review:null,candidates:[],eligibleSettlers:0,escalationRequired:true}}));
 await page.getByRole('navigation',{name:'Accounting destinations',exact:true}).getByRole('button',{name:'Settlements',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Accounting settlement queue'})).toBeVisible({timeout:45000});
 const notice=page.getByRole('alert',{name:'Settlement blocked'});
 await expect(notice).toContainText('No eligible Accounting Officer');
 await expect(notice).toContainText('No independent leadership reviewer is available either');
 await expect(page.getByRole('button',{name:'Settle & post',exact:true})).toHaveAttribute('aria-disabled','true');
 expect(state.writes).toHaveLength(0);
 await page.screenshot({path:info.outputPath('settlement-blocked-desktop.png'),fullPage:true});
});
