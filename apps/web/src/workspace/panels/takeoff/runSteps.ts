export const RUN_STEPS: [string, string][] = [
  ['Context', 'Read the project information'], ['Read', 'Read the model'], ['Catalogue', 'Group into types'], ['Understand', 'Understand the building'],
  ['Map', 'Map types to BOQ items'], ['Derive', 'Derive formwork and beds'], ['BOQ', 'Build the BOQ'], ['Review', 'Review the draft'],
];

export const WEIGHT: Record<string, number> = { Context: 0.03, Read: 0.08, Catalogue: 0.02, Understand: 0.07, Map: 0.48, Derive: 0.03, BOQ: 0.02, Review: 0.27 };
