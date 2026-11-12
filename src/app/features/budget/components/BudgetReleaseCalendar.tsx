import { useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import { getPhilippineCalendarDate } from '../../../shared/calendarDates';
import { pendingReleaseAmount } from '../selectors/budgetReleaseSchedule';
import type { DepartmentBudgetBundle } from '../types';
import { peso } from './budgetUi';
import './budgetReleaseCalendar.css';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function BudgetReleaseCalendar({ data }: { data: DepartmentBudgetBundle }) {
  const today = getPhilippineCalendarDate();
  const year = data.summary?.fiscalYear ?? Number(today.slice(0, 4));
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)) - 1);
  const [day, setDay] = useState('');

  if (!data.releaseScheduleAvailable) return null;
  const releases = (data.sections ?? []).filter(account => !account.retired)
    .flatMap(account => (account.releaseSchedule ?? []).map(release => ({ account, release })))
    .sort((a, b) => a.release.date.localeCompare(b.release.date));
  if (!releases.length) return null;

  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const visible = releases.filter(({ release }) => release.date.startsWith(prefix) && (!day || release.date === day));
  const scheduledDates = new Set(releases.map(({ release }) => release.date));
  const monthStart = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const pending = pendingReleaseAmount(releases.map(({ release }) => release));
  const changeMonth = (offset: number) => {
    setMonth(current => current + offset);
    setDay('');
  };

  return (
    <section className="budget-release-calendar" aria-label="Office budget release calendar">
      <header>
        <div>
          <h3><CalendarDays size={21} />Budget release calendar</h3>
          <p>In a locked budget, each scheduled amount becomes available on its release date (Philippine time).</p>
        </div>
        <span className="budget-release-status"><Clock3 size={14} />{peso.format(pending)} pending</span>
      </header>
      <div className="budget-release-calendar__layout">
        <div className="budget-release-calendar__month">
          <nav aria-label="Release calendar month">
            <button type="button" aria-label="Previous release month" disabled={month === 0} onClick={() => changeMonth(-1)}><ChevronLeft size={19} /></button>
            <strong>{monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong>
            <button type="button" aria-label="Next release month" disabled={month === 11} onClick={() => changeMonth(1)}><ChevronRight size={19} /></button>
          </nav>
          <div className="budget-release-calendar__grid">
            {WEEKDAYS.map(label => <span className="budget-release-calendar__weekday" key={label}>{label}</span>)}
            {Array.from({ length: monthStart.getDay() }, (_, i) => <span key={`blank-${i}`} />)}
            {Array.from({ length: days }, (_, i) => {
              const date = `${prefix}-${String(i + 1).padStart(2, '0')}`;
              const scheduled = scheduledDates.has(date);
              return (
                <button key={date} type="button" aria-label={`Show releases for ${date}`} aria-pressed={day === date}
                  data-today={today === date} data-scheduled={scheduled} onClick={() => setDay(day === date ? '' : date)}>
                  {i + 1}{scheduled && <i aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <button type="button" className="budget-release-calendar__all" onClick={() => setDay('')}>Show all releases this month</button>
        </div>
        <div className="budget-release-calendar__list">
          <h4>{day ? `Releases on ${day}` : 'This month’s releases'}</h4>
          {visible.length ? visible.map(({ account, release }) => {
            const released = release.status === 'confirmed';
            return (
              <article key={`${account.id}:${release.id}`}>
                <div>
                  <strong>{account.name}</strong>
                  <small>{release.date}</small>
                  <span className="budget-release-status" data-status={release.status}>
                    {released ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
                    {released ? 'Released' : data.summary?.status === 'locked' && release.date <= today ? 'Release due' : 'Scheduled'}
                  </span>
                  {released && release.automatic && <small>Released automatically</small>}
                  {released && !release.automatic && release.confirmedByName && (
                    <small>Confirmed by {release.confirmedByName}{release.reference ? ` · ${release.reference}` : ''}</small>
                  )}
                </div>
                <div className="budget-release-calendar__amount"><strong>{peso.format(release.amount)}</strong></div>
              </article>
            );
          }) : <p className="budget-release-calendar__empty">No releases scheduled {day ? 'for this date' : 'this month'}.</p>}
        </div>
      </div>
    </section>
  );
}
