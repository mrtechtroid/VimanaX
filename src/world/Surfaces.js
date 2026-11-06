/**
 * Ground surface types. Multipliers are relative to asphalt:
 *  roll = rolling resistance, brake = braking effectiveness, grip = lateral/steering grip, bump = roughness (m of body shake at speed),
 *  veh = ground-vehicle top speed factor, foot = footstep sample set.
 */
export const SURFACES = {
  asphalt: { id: 'asphalt', label: 'Asphalt', roll: 1, brake: 1, grip: 1, bump: 0, veh: 1, foot: 'hard', color: 0x35373a },
  grass: { id: 'grass', label: 'Grass', roll: 3.2, brake: 0.65, grip: 0.7, bump: 0.35, veh: 0.8, foot: 'grass', color: 0x56853a },
  dirt: { id: 'dirt', label: 'Dirt', roll: 4, brake: 0.6, grip: 0.6, bump: 0.6, veh: 0.75, foot: 'dirt', color: 0x8c6e47 },
  sand: { id: 'sand', label: 'Sand', roll: 7, brake: 0.5, grip: 0.45, bump: 0.25, veh: 0.55, foot: 'dirt', color: 0xd8c98f },
  rock: { id: 'rock', label: 'Rock', roll: 5, brake: 0.7, grip: 0.8, bump: 1, veh: 0.6, foot: 'hard', color: 0x7a6f5f },
  water: { id: 'water', label: 'Water', roll: 20, brake: 0.2, grip: 0.1, bump: 0.1, veh: 0, foot: 'water', color: 0x1d5f8a },
};
