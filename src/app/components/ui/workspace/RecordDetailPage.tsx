import {useId,useLayoutEffect,useRef,type ReactNode} from 'react';
import {Button} from '@vibe/core';
import {ArrowLeft,ChevronRight} from 'lucide-react';
import {requestNavigation} from '../../../shared/navigationGuard';
import './recordDetailPage.css';

/** Presentation only. The feature owner supplies already-authorized content. */
export function RecordDetailPage({title,subtitle,backLabel,breadcrumb,detailLabel='Details',onBack,status,actions,children}: {
 title:string;subtitle?:string;backLabel:string;breadcrumb:string;detailLabel?:string;onBack:()=>void;
 status?:ReactNode;actions?:ReactNode;children:ReactNode;
}){
 const heading=useRef<HTMLHeadingElement>(null),page=useRef<HTMLElement>(null),titleId=useId();
 const back=()=>void requestNavigation(onBack);
 useLayoutEffect(()=>{heading.current?.focus({preventScroll:true});page.current?.scrollIntoView?.({block:'start',behavior:'instant'});},[]);
 return <section ref={page} className="record-detail-page" aria-labelledby={titleId}>
  <nav className="record-detail-page__breadcrumb" aria-label="Breadcrumb">
   <button type="button" onClick={back}>{breadcrumb}</button><ChevronRight size={14} aria-hidden="true"/><span aria-current="page">{detailLabel}</span>
  </nav>
  <header className="record-detail-page__header">
   <div className="record-detail-page__back"><Button kind="tertiary" onClick={back}><ArrowLeft size={16} aria-hidden="true"/>{backLabel}</Button></div>
   <div className="record-detail-page__heading">
    <div className="record-detail-page__title"><div className="record-detail-page__status">{status}</div><h1 ref={heading} tabIndex={-1} id={titleId}>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>
    {actions&&<div className="record-detail-page__actions">{actions}</div>}
   </div>
  </header>
  <div className="record-detail-page__body">{children}</div>
 </section>;
}
