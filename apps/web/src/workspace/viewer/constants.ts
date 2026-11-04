export type RGB = [number, number, number];

export const COLOUR: Record<string, RGB> = {
  High: [0.29, 0.86, 0.52], Medium: [0.95, 0.69, 0.2], Low: [0.93, 0.45, 0.16], 'Not mapped': [0.78, 0.2, 0.16],
};
export const HEX: Record<string, string> = { High: '#2e9d5b', Medium: '#e0a93a', Low: '#e0712f', Excluded: '#b9bec4', 'Not mapped': '#c0392b' };
export const GOLD: RGB = [0.91, 0.69, 0.24]; // under construction on the 4D player's day
export const GLASS = new Set(['IfcWindow', 'IfcPlate', 'IfcCurtainWall']);
export const GROUND = /site|terrain|topograph|ground surface/i; // left out when fitting the camera: it can dwarf the building
export const NEAR = 18; // px: dots this close merge into a count
export const HIDDEN_CLASSES = new Set(['IfcSpace', 'IfcOpeningElement']); // room volumes and openings hide the building
