import pluginTester, { prettierFormatter } from 'babel-plugin-tester';
import * as fs from 'fs';
import * as path from 'path';

import { transformPlugin } from './transformPlugin';

const prettierConfig = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../.prettierrc'), { encoding: 'utf-8' }),
);
const fixturesDir = path.join(__dirname, '..', '__fixtures__');

pluginTester({
  babelOptions: {
    parserOpts: {
      plugins: ['typescript'],
    },
  },
  pluginOptions: {
    babelOptions: {
      presets: ['@babel/typescript'],
    },
  },
  formatResult: code =>
    prettierFormatter(code, {
      config: {
        ...prettierConfig,
        parser: 'typescript',
      },
    }),

  fixtures: fixturesDir,
  // tests: [{
  //   only: true,
  //   fixture: path.resolve(fixturesDir, 'native-and-context-selector/code.ts'),
  //   outputFixture: path.resolve(fixturesDir, 'native-and-context-selector/output.ts'),
  // }],

  plugin: transformPlugin,
  pluginName: '@griffel/babel-plugin-transform',
});
