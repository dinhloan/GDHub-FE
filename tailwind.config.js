import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const tokenSource = fs.readFileSync(new URL('./src/themeTokens.ts', import.meta.url), 'utf8');
const transpiledTokens = ts.transpileModule(tokenSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const tokenModule = { exports: {} };
vm.runInNewContext(transpiledTokens.outputText, { exports: tokenModule.exports, module: tokenModule });

const { themeTokens } = tokenModule.exports;

const toKebab = (key) => key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
const toCssTokenName = (key) => toKebab(key).replace(/\./g, '-');
const mapTokenVars = (scope, tokens) =>
  Object.fromEntries(Object.keys(tokens).map((key) => [toKebab(key), `var(--md-sys-${scope}-${toCssTokenName(key)})`]));

const toOpacityPercent = (opacityValue) => {
  const numericOpacity = Number(opacityValue);
  return Number.isFinite(numericOpacity) ? `${Number((numericOpacity * 100).toFixed(4))}%` : `calc(${opacityValue} * 100%)`;
};

const tokenColor = (key) => ({ opacityValue }) => {
  const cssVariable = `var(--md-sys-color-${toCssTokenName(key)})`;
  return opacityValue === undefined
    ? cssVariable
    : `color-mix(in srgb, ${cssVariable} ${toOpacityPercent(opacityValue)}, transparent)`;
};

const colorEntries = Object.fromEntries(Object.keys(themeTokens.colors).map((key) => [toKebab(key), tokenColor(key)]));
const fontSizeEntries = Object.fromEntries(
  Object.entries(themeTokens.typography.fontSize).map(([key]) => [
    toKebab(key),
    [`var(--md-sys-typescale-size-${toCssTokenName(key)})`, { lineHeight: `var(--md-sys-typescale-line-height-${toCssTokenName(key)})` }],
  ]),
);

const cssVariables = Object.fromEntries([
  ...Object.entries(themeTokens.colors).map(([key, value]) => [`--md-sys-color-${toCssTokenName(key)}`, value]),
  ...Object.entries(themeTokens.typography.fontFamily).map(([key, value]) => [`--md-sys-font-${toCssTokenName(key)}`, value.join(', ')]),
  ...Object.entries(themeTokens.typography.fontSize).flatMap(([key, value]) => [
    [`--md-sys-typescale-size-${toCssTokenName(key)}`, value[0]],
    [`--md-sys-typescale-line-height-${toCssTokenName(key)}`, value[1].lineHeight],
  ]),
  ...Object.entries(themeTokens.typography.fontWeight).map(([key, value]) => [`--md-sys-font-weight-${toCssTokenName(key)}`, value]),
  ...Object.entries(themeTokens.typography.letterSpacing).map(([key, value]) => [`--md-sys-tracking-${toCssTokenName(key)}`, value]),
  ...Object.entries(themeTokens.spacing).map(([key, value]) => [`--md-sys-space-${toCssTokenName(key)}`, value]),
  ...Object.entries(themeTokens.radius).map(([key, value]) => [`--md-sys-shape-${toCssTokenName(key)}`, value]),
  ...Object.entries(themeTokens.shadows).map(([key, value]) => [`--md-sys-elevation-${toCssTokenName(key)}`, value]),
]);

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: colorEntries,
      fontFamily: mapTokenVars('font', themeTokens.typography.fontFamily),
      fontSize: fontSizeEntries,
      fontWeight: mapTokenVars('font-weight', themeTokens.typography.fontWeight),
      letterSpacing: mapTokenVars('tracking', themeTokens.typography.letterSpacing),
      spacing: mapTokenVars('space', themeTokens.spacing),
      borderRadius: mapTokenVars('shape', themeTokens.radius),
      boxShadow: {
        ...mapTokenVars('elevation', themeTokens.shadows),
        'level-3': 'var(--md-sys-elevation-level3)',
      },
      maxWidth: {
        shell: 'var(--md-sys-space-shell)',
        workspace: 'var(--md-sys-space-workspace)',
      },
      minHeight: {
        shell: 'var(--md-sys-space-shell-tall)',
        editor: 'var(--md-sys-space-editor)',
      },
      gridTemplateColumns: {
        editor: 'minmax(0, 1fr) var(--md-sys-space-editor-aside)',
        'stitch-main': 'minmax(0, 75%) minmax(0, 25%)',
      },
    },
  },
  plugins: [
    ({ addBase }) => {
      addBase({
        ':root': cssVariables,
      });
    },
  ],
};
