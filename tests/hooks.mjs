export async function resolve(spec, ctx, next) {
  if (spec === 'three' && ctx.parentURL?.includes('/src/')) return { url: new URL('./stub-three.mjs', import.meta.url).href, shortCircuit: true };
  return next(spec, ctx);
}
