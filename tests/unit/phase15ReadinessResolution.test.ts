import { describe, expect, it } from 'vitest';
import { readinessResolution, closeoutResolution } from '../../src/app/features/project-readiness/resolution';
describe('Phase 15 official blocker destinations',()=>{
 it('routes concrete server check keys without inventing a destination for unknown checks',()=>{expect(readinessResolution('staffing',false)?.view).toBe('tasks');expect(readinessResolution('invitations',false)?.view).toBe('offices');expect(readinessResolution('office_identity',false)?.view).toBe('offices');expect(readinessResolution('schedule',false)?.view).toBe('gantt');expect(readinessResolution('budget',false)?.view).toBe('budget');expect(readinessResolution('new_server_key',false)).toBeNull();});
 it('retains existing proposal sign-off and financial ownership',()=>{expect(readinessResolution('structure',true)?.view).toBe('proposal_context');expect(closeoutResolution('cash')?.view).toBe('budget');expect(closeoutResolution('governance')?.view).toBe('proposal_context');expect(closeoutResolution('private')).toBeNull();});
});
