import './reviewSections.css';
export interface ReviewSection { id: string; label: string; detail: string }
/** Local review navigation never starts analysis or a mutation. */
export function ReviewSectionNav({ sections, selected, onSelect, label = 'Review sections' }: { sections: ReviewSection[]; selected: string; onSelect: (id: string) => void; label?: string }) {
  return <nav aria-label={label} className="eflow-review-sections">{sections.map(section => <button type="button" key={section.id} aria-current={selected === section.id ? 'step' : undefined} onClick={() => onSelect(section.id)}><strong>{section.label}</strong><span>{section.detail}</span></button>)}</nav>;
}
