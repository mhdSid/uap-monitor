// @ts-check
/**
 * Stryker mutation testing config.
 *
 * Scoped to a few pure-logic composables with strong test coverage — the
 * files where mutation testing produces meaningful signal. Expand `mutate`
 * once the workflow is proven (e.g. add use-seismic.ts, use-geomagnetic.ts).
 *
 * Run with: `yarn test:mutation`  (alias for `stryker run`)
 * HTML report: reports/mutation/mutation.html
 *
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
export default {
  testRunner: 'vitest',
  coverageAnalysis: 'perTest',
  tsconfigFile: 'tsconfig.json',
  mutate: [
    'src/composables/use-filter.ts',
    'src/composables/use-store.ts',
    'src/composables/use-fireball.ts',
    'src/composables/use-async-action.ts'
  ],
  reporters: ['html', 'clear-text', 'progress']
}
