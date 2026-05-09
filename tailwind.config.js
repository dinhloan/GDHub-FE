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
const cssVarName = (scope, key) => `--${scope}-${toKebab(key)}`;
const mapTokenKeys = (tokens) => Object.fromEntries(Object.entries(tokens).map(([key, value]) => [toKebab(key), value]));

const colorEntries = mapTokenKeys(themeTokens.colors);

const cssVariables = Object.fromEntries([
  ...Object.entries(themeTokens.colors).map(([key, value]) => [cssVarName('color', key), value]),
  ...Object.entries(themeTokens.radius).map(([key, value]) => [cssVarName('radius', key), value]),
  ...Object.entries(themeTokens.shadows).map(([key, value]) => [cssVarName('shadow', key), value]),
]);

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: colorEntries,
      fontFamily: mapTokenKeys(themeTokens.typography.fontFamily),
      fontSize: mapTokenKeys(themeTokens.typography.fontSize),
      fontWeight: mapTokenKeys(themeTokens.typography.fontWeight),
      letterSpacing: mapTokenKeys(themeTokens.typography.letterSpacing),
      spacing: mapTokenKeys(themeTokens.spacing),
      borderRadius: mapTokenKeys(themeTokens.radius),
      boxShadow: mapTokenKeys(themeTokens.shadows),
      maxWidth: {
        shell: themeTokens.spacing.shell,
      },
      minHeight: {
        shell: themeTokens.spacing.shellTall,
        editor: themeTokens.spacing.editor,
      },
      gridTemplateColumns: {
        editor: `minmax(0, 1fr) ${themeTokens.spacing.editorAside}`,
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
