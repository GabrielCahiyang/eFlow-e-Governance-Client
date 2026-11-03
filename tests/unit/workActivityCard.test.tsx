// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {cleanup,render,screen,within} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {WorkActivityCard} from '../../src/app/features/nested-work/components/WorkActivityCard';
import type {WorkEvent} from '../../src/app/features/nested-work/services/workTreeService';
afterEach(cleanup);
const event={id:'event',actor_name:'Cheryl Gallo',command:'staff',occurred_at:'2026-10-31T12:40:00Z'} as WorkEvent;
it('shows an actor, timestamp and separate before-and-after values',()=>{
 render(<ol><WorkActivityCard event={event} presentation={{title:'Subtask people updated',detail:'Recorded changes',entries:['Path: Draft the meeting checklist','Contributors: No contributors → Crisostomo Ibarra']}}/></ol>);
 const card=screen.getByRole('article',{name:'Subtask people updated'});
 expect(within(card).getByText('Cheryl Gallo')).toBeVisible();expect(within(card).getByText('Crisostomo Ibarra')).toHaveClass('nw-activity-after');expect(within(card).getByText('No contributors')).toHaveClass('nw-activity-before');
 expect(card.querySelector('time')).toHaveAttribute('dateTime',event.occurred_at);expect(screen.getByText('CG')).toHaveAttribute('aria-hidden','true');
});
it('omits unchanged fields without losing real changes',()=>{
 render(<ol><WorkActivityCard event={event} presentation={{title:'Subtask created',detail:'Recorded changes',entries:['Contributors: No contributors → No contributors','Lead: No Lead → Gabriel Cahiyang']}}/></ol>);
 expect(screen.queryByText('Contributors')).toBeNull();expect(screen.getByText('Gabriel Cahiyang')).toBeVisible();
});
it('shows deadline urgency at the time of the recorded change',()=>{
 render(<ol><WorkActivityCard event={{...event,occurred_at:'2026-11-03T12:00:00+08:00'}} presentation={{title:'Subtask edited',detail:'Recorded changes',entries:['Deadline: No deadline → 2026-11-05']}}/></ol>);
 expect(screen.getByText('Nov 5, 2026')).toBeVisible();
 expect(screen.getByText('At change ·')).toBeVisible();
 expect(screen.getByText('2 days left')).toBeVisible();
});
