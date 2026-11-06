/** Data-driven world: add islands/airports here. heading in degrees (0 = north, 90 = east). */
export default {
  size: 16000, segments: 220,
  islands: [
    { x: 0, z: 0, r: 3000, h: 450 },
    { x: 5500, z: -2500, r: 1800, h: 220 },
  ],
  airports: [
    { id: 'main', name: 'Main Island Intl', x: 0, z: 1500, heading: 180, length: 1400, width: 32, elev: 4 },
    { id: 'east', name: 'East Strip', x: 5500, z: -1000, heading: 90, length: 1000, width: 28, elev: 4 },
    { id: 'meadow', name: 'Meadow Field', x: -2200, z: 1100, heading: 270, length: 650, width: 22, elev: 8, surface: 'grass' },
    { id: 'dune', name: 'Dune Strip', x: 6300, z: -1800, heading: 180, length: 520, width: 20, elev: 12, surface: 'dirt' },
  ],
};
