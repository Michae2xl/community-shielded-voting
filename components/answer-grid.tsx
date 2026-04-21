"use client";

import type { OptionLetter } from "@/lib/domain/options";

export type AnswerGridOption = {
  optionLetter: OptionLetter;
  label?: string;
  zip321Uri?: string;
};

export function AnswerGrid({
  options,
  onSelect,
  selectedOptionLetter
}: {
  options: AnswerGridOption[];
  onSelect: (option: AnswerGridOption) => void;
  selectedOptionLetter?: OptionLetter | null;
}) {
  return (
    <div className="answer-grid" role="list" aria-label="Answer options">
      {options.map((option) => (
        <button
          key={option.optionLetter}
          type="button"
          className={`answer-card${selectedOptionLetter === option.optionLetter ? " answer-card--selected" : ""}`}
          onClick={() => onSelect(option)}
          aria-pressed={selectedOptionLetter === option.optionLetter}
        >
          <span className="answer-letter">{option.optionLetter}</span>
          <span>{option.label ?? `Option ${option.optionLetter}`}</span>
        </button>
      ))}
    </div>
  );
}
