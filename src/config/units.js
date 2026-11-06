/** Unit systems: [label, factor from SI]. Add a system by adding a key. */
export const UNITS = {
  aviation: { speed: ['kt', 1.943844], alt: ['ft', 3.28084], dist: ['nm', 1 / 1852], vs: ['fpm', 196.85] },
  metric:   { speed: ['km/h', 3.6],    alt: ['m', 1],        dist: ['km', 0.001],    vs: ['m/s', 1] },
  imperial: { speed: ['mph', 2.236936], alt: ['ft', 3.28084], dist: ['mi', 1 / 1609.34], vs: ['fpm', 196.85] },
};
export const fmt = (sys, kind, v) => { const [u, f] = UNITS[sys][kind]; return `${Math.round(v * f)} ${u}`; };
