// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installNavigationConfirmation } from '../../src/app/shared/navigationGuard';
const calls=vi.hoisted(()=>({read:vi.fn(),private:vi.fn(),update:vi.fn()}));
vi.mock('../../src/app/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'me'}})}));
vi.mock('../../src/app/features/professional-profile/services/professionalProfileService',()=>({getProfessionalProfile:calls.read,getMyPds:calls.private,updateProfessionalProfile:calls.update}));
import { ProfessionalProfilePanel } from '../../src/app/features/professional-profile/components/ProfessionalProfilePanel';
let uninstall:(()=>void)|undefined;
const profile={skills:['Planning'],education:[],trainings:[],certifications:[],work_experience:[],specializations:[],competency_summary:'Work summary',confirmed_by_user:true};
beforeEach(()=>{vi.clearAllMocks();calls.read.mockResolvedValue({profile});calls.private.mockResolvedValue({documents:[]});});afterEach(()=>{cleanup();uninstall?.();});
describe('Phase 14 lazy professional privacy and drafts',()=>{
 it('never fetches another member private PDS and retries a denied summary without claiming missing data',async()=>{
  calls.read.mockRejectedValueOnce(new Error('Read denied'));render(<ProfessionalProfilePanel userId="member"/>);await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('not loaded'));expect(calls.private).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Retry'}));await waitFor(()=>expect(screen.getByText('Work summary')).toBeTruthy());expect(calls.private).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Edit profile'})).toBeNull();
 });
 it('only guards changed own profile drafts and retains denied save fields',async()=>{
  const decision=vi.fn().mockResolvedValue(false);uninstall=installNavigationConfirmation(decision);calls.update.mockRejectedValue(new Error('Save denied'));render(<ProfessionalProfilePanel/>);await screen.findByRole('button',{name:'Edit profile'});
  fireEvent.click(screen.getByRole('button',{name:'Edit profile'}));await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Cancel'})));expect(decision).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Edit profile'}));fireEvent.change(screen.getByLabelText('Skills'),{target:{value:'Changed skills'}});fireEvent.click(screen.getByRole('button',{name:'Cancel'}));await waitFor(()=>expect(decision).toHaveBeenCalledOnce());expect((screen.getByLabelText('Skills') as HTMLTextAreaElement).value).toBe('Changed skills');
  fireEvent.click(screen.getByRole('button',{name:'Save changes'}));await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('Save denied'));expect((screen.getByLabelText('Skills') as HTMLTextAreaElement).value).toBe('Changed skills');
 });
});
