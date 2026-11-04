export const SPEEDS = [1, 2, 5, 10, 20]; // days a second the 4D player can play
export const ZOOMS = ['Days', 'Weeks', 'Months'] as const;
export const VIEWS = ['Gantt', 'Table', 'Cost curve'] as const;

export const ROW = 23; // px per activity in the Gantt
export const PX = { Days: 24, Weeks: 8.6, Months: 2.6 }; // px per day at each zoom
export const LEFT = 310; // px of the activity names beside the bars
