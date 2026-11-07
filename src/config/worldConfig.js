/**
 * Data-driven world. Add islands / lakes / towns / airports here. heading in degrees (0 = north, 90 = east).
 * The map is finite: size x size metres (centre = 0,0), surrounded by open ocean. elev 'auto' = sample the terrain.
 */
export default {
  size: 24000, grid: 1024, seed: 7, rivers: 12,
  islands: [
    { x: 0, z: 0, r: 3700, h: 1150 },
    { x: 6200, z: -2600, r: 2400, h: 540 },
    { x: -3800, z: -6800, r: 2800, h: 780 },
    { x: -6600, z: 4300, r: 2100, h: 400 },
    { x: 2500, z: 7000, r: 1800, h: 280 },
  ],
  lakes: [{ x: -700, z: -1000, r: 320 }, { x: 1200, z: -1700, r: 240 }, { x: -3900, z: -6900, r: 280 }, { x: 6000, z: -3300, r: 220 }],
  towns: [
    { id: 'harmony', name: 'Port Harmony', x: 1000, z: 2300, r: 380, size: 1.0 },
    { id: 'lakeside', name: 'Lakeside', x: -1500, z: -300, r: 260, size: 0.6 },
    { id: 'meadowbrook', name: 'Meadowbrook', x: -2700, z: 1900, r: 240, size: 0.5 },
    { id: 'eastharbor', name: 'East Harbor', x: 5200, z: -1500, r: 300, size: 0.7 },
    { id: 'northlanding', name: 'North Landing', x: -3300, z: -5900, r: 300, size: 0.7 },
    { id: 'coralbay', name: 'Coral Bay', x: -6200, z: 4200, r: 280, size: 0.6 },
  ],
  airports: [
    { id: 'main', name: 'Main Island Intl', x: 0, z: 1500, heading: 180, length: 2300, width: 45, elev: 4 },
    { id: 'east', name: 'East Strip', x: 5500, z: -1000, heading: 90, length: 1000, width: 28, elev: 4 },
    { id: 'meadow', name: 'Meadow Field', x: -2200, z: 1100, heading: 270, length: 650, width: 22, elev: 8, surface: 'grass' },
    { id: 'dune', name: 'Dune Strip', x: 6300, z: -1800, heading: 180, length: 520, width: 20, elev: 12, surface: 'dirt' },
    { id: 'north', name: 'North Landing Airfield', x: -3000, z: -6300, heading: 20, length: 900, width: 26, elev: 24 },
    { id: 'coral', name: 'Coral Bay Airport', x: -6000, z: 4600, heading: 90, length: 850, width: 26, elev: 16 },
    { id: 'bay', name: 'Harmony Bay Seaplane Base', x: 1500, z: 4400, heading: 90, length: 1000, width: 80, elev: 0, surface: 'water', water: true },
    { id: 'cape', name: 'Cape Grass Strip', x: 2500, z: 6700, heading: 0, length: 560, width: 20, elev: 14, surface: 'grass' },
  ],
};
