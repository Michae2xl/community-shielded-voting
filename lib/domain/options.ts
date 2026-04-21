export const OPTION_LETTERS = ["A", "B", "C", "D", "E"] as const;

export type OptionLetter = (typeof OPTION_LETTERS)[number];

export type OptionLabelFields = {
  optionALabel?: string | null;
  optionBLabel?: string | null;
  optionCLabel?: string | null;
  optionDLabel?: string | null;
  optionELabel?: string | null;
};

export const OPTION_LABEL_FIELD_BY_LETTER = {
  A: "optionALabel",
  B: "optionBLabel",
  C: "optionCLabel",
  D: "optionDLabel",
  E: "optionELabel"
} as const satisfies Record<OptionLetter, keyof OptionLabelFields>;

export function normalizeOptionLabel(label: string) {
  return label.trim();
}

function rawOptionLabel(
  input: OptionLabelFields,
  letter: OptionLetter
): string | null | undefined {
  return input[OPTION_LABEL_FIELD_BY_LETTER[letter]];
}

export function resolveOptionLabel(
  letter: OptionLetter,
  label?: string | null
) {
  const normalized = normalizeOptionLabel(label ?? "");

  return normalized || `Option ${letter}`;
}

export function getActiveOptionLetters(input: OptionLabelFields) {
  const configuredLetters = OPTION_LETTERS.filter((letter) =>
    normalizeOptionLabel(rawOptionLabel(input, letter) ?? "")
  );

  if (configuredLetters.length === 0) {
    return [...OPTION_LETTERS];
  }

  return configuredLetters;
}

export function getPollOptionEntries(input: OptionLabelFields) {
  return getActiveOptionLetters(input).map((letter) => ({
    letter,
    label: resolveOptionLabel(letter, rawOptionLabel(input, letter))
  }));
}

export function getPollOptionLabelMap(input: OptionLabelFields) {
  return Object.fromEntries(
    OPTION_LETTERS.map((letter) => [
      letter,
      resolveOptionLabel(letter, rawOptionLabel(input, letter))
    ])
  ) as Record<OptionLetter, string>;
}
