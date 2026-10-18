import {getPhilippineCalendarDate,isCalendarDate} from './calendarDates';
/** Date-only expiry means the end of that Philippine calendar day. */
export function announcementExpiryError(value?:string|null,now=new Date()){
 if(!value)return '';
 if(!isCalendarDate(value))return 'Expiration date must be a valid date.';
 return value<getPhilippineCalendarDate(now)?'Expiration date cannot be in the past.':'';
}
export function announcementExpiryTimestamp(value?:string|null){
 const issue=announcementExpiryError(value);if(issue)throw new Error(issue);
 return value?new Date(`${value}T23:59:59.999+08:00`).toISOString():null;
}
