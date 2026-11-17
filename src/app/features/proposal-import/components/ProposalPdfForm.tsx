import { useId, useState } from 'react';
import { Button } from '@vibe/core';
import { Upload } from '@vibe/icons';
import type { ProposalImportOptions } from '../types';

const taskOptions = [
  { key: 'addSubtasks', label: 'Add subtasks', hint: 'Include source steps and practical preparation, such as preparing a presentation for a meeting.' },
  { key: 'addBudget', label: 'Add task budgets', hint: 'Use amounts from the PDF as task estimates for review.' },
  { key: 'assignPeople', label: 'Suggest people', hint: 'Match eligible staff to tasks using skills and workload.' },
] as const;

export function ProposalPdfForm({ options, onOptionsChange, onStart, allowDocumentOnly = false, hint, disabled = false }: {
  options: ProposalImportOptions;
  onOptionsChange: (options: ProposalImportOptions) => void;
  onStart: (file: File) => void;
  allowDocumentOnly?: boolean;
  hint: string;
  disabled?: boolean;
}) {
  const id = useId();
  const [file, setFile] = useState<File | null>(null);

  return <fieldset disabled={disabled} className="min-w-0 border-0 p-0">
    <fieldset className="mb-5 rounded-xl border border-neutral-200 p-4">
      <legend className="px-2 font-semibold">Import options</legend>
      {allowDocumentOnly && <label className="flex items-start gap-3 p-2">
        <input type="checkbox" className="mt-1" checked={options.addTasks} onChange={event => onOptionsChange({ ...options, addTasks: event.target.checked })} />
        <span><strong className="block">Add tasks</strong><small className="block text-neutral-600">Clear this to save the proposal PDF as a draft and add tasks yourself.</small></span>
      </label>}
      <div className="grid gap-1 sm:grid-cols-3">
        {taskOptions.map(({ key, label, hint }) => <label key={key} className="flex items-start gap-3 p-2">
          <input type="checkbox" className="mt-1" disabled={!options.addTasks} checked={options.addTasks && options[key]} onChange={event => onOptionsChange({ ...options, [key]: event.target.checked })} />
          <span><strong className="block">{label}</strong><small className="block text-neutral-600">{hint}</small></span>
        </label>)}
      </div>
    </fieldset>
    <label
      htmlFor={id}
      onDragOver={event => event.preventDefault()}
      onDrop={event => {
        event.preventDefault();
        const dropped = event.dataTransfer.files[0];
        if (!disabled && dropped) setFile(dropped);
      }}
      className="group block cursor-pointer rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-8 text-center transition-colors hover:bg-primary/10 focus-within:ring-2 focus-within:ring-primary sm:p-12"
    >
      <Upload size={40} className="mx-auto mb-3 text-primary/60 group-hover:text-primary" />
      <div className="text-sm font-bold text-neutral-800">{file ? file.name : 'Drop a government proposal PDF here'}</div>
      <div className="mt-1 text-xs text-neutral-500">{file ? 'Click to choose a different PDF' : 'Or click to browse'}</div>
      <div className="mt-4 inline-block rounded-full border border-primary/20 bg-card px-4 py-1.5 text-[11px] text-neutral-500 shadow-xs">{hint}</div>
      <input
        id={id}
        aria-label="Choose a government proposal PDF"
        type="file"
        accept=".pdf,application/pdf"
        className="sr-only"
        onChange={event => {
          const selected = event.target.files?.[0];
          if (selected) setFile(selected);
          event.target.value = '';
        }}
      />
    </label>
    <div className="mt-4 flex justify-end">
      <Button kind="primary" disabled={disabled || !file} onClick={() => { if (file) onStart(file); }}>Start import</Button>
    </div>
  </fieldset>;
}
