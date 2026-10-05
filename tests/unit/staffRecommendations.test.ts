import { describe, it, expect, vi } from 'vitest';
vi.mock('../../src/app/shared/phase2Api',()=>({phase2Request:vi.fn()}));
vi.mock('../../src/app/features/ai',()=>({requestAiChat:vi.fn(),readAiText:vi.fn()}));
import { parseStaffRecommendations } from '../../src/app/features/staffing/services/staffingService';
import type { StaffingContext } from '../../src/app/features/staffing/types';
const context: StaffingContext = {task:{id:'task',title:'Assess site',description:'Survey the site',skills:['Surveying']},excludedUnconfirmed:1,candidates:[{id:'member',name:'Casey',skills:['Surveying'],training:['Safety training'],education:[],experience:[],specializations:[],certifications:[],experience_summary:'',activeTasks:4,remainingHours:12,unknownEffortTasks:2}]};
describe('confirmed staffing recommendations',()=>{
 it('drops foreign identities and invented claims; workload comes from context',()=>{
  const result=parseStaffRecommendations(JSON.stringify({recommendations:[{userId:'foreign',evidence:['Surveying']},{userId:'member',evidence:['Surveying','Invented expertise'],activeTasks:0,remainingHours:0,matchPercentage:99},{userId:'member',evidence:['Safety training']}]}),context);
  expect(result).toEqual([{userId:'member',evidence:['Surveying'],activeTasks:4,remainingHours:12,unknownEffortTasks:2}]);
  expect(result[0]).not.toHaveProperty('matchPercentage');
 });
 it('rejects unsupported recommendations instead of silently assigning',()=>{
  expect(()=>parseStaffRecommendations('{"recommendations":[{"userId":"member","evidence":["invented"]}]}',context)).toThrow('confirmed profile');
  expect(()=>parseStaffRecommendations('{"recommendations":null}',context)).toThrow('incomplete');
 });
});
