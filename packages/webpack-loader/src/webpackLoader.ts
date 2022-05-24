import { BabelPluginOptions } from '@global-context/babel-preset';
import { getOptions } from 'loader-utils';
import * as path from 'path';
import * as webpack from 'webpack';

import { transformSync, TransformResult, TransformOptions } from './transformSync';

export type WebpackLoaderOptions = BabelPluginOptions;

type WebpackLoaderParams = Parameters<webpack.LoaderDefinitionFunction<WebpackLoaderOptions>>;

export function shouldTransformSourceCode(
  sourceCode: string,
  modules: WebpackLoaderOptions['modules'] | undefined,
): boolean {
  const imports = modules ? modules.map(module => module.importName).join('|') : 'createContext';

  return new RegExp(`\\b(${imports})`).test(sourceCode);
}

/**
 * Webpack can also pass sourcemaps as a string, Babel accepts only objects.
 * See https://github.com/babel/babel-loader/pull/889.
 */
function parseSourceMap(inputSourceMap: WebpackLoaderParams[1]): TransformOptions['inputSourceMap'] {
  try {
    if (typeof inputSourceMap === 'string') {
      return JSON.parse(inputSourceMap) as TransformOptions['inputSourceMap'];
    }

    return inputSourceMap as TransformOptions['inputSourceMap'];
  } catch (err) {
    return undefined;
  }
}

export function webpackLoader(
  this: webpack.LoaderContext<never>,
  sourceCode: WebpackLoaderParams[0],
  inputSourceMap: WebpackLoaderParams[1],
) {
  // Loaders are cacheable by default, but in there edge cases/bugs when caching does not work until it's specified:
  // https://github.com/webpack/webpack/issues/14946
  this.cacheable();

  const options = getOptions(this as any) as WebpackLoaderOptions;

  // validate(configSchema, options, {
  //   name: '@griffel/webpack-loader',
  //   baseDataPath: 'options',
  // });

  // Early return to handle cases when createContext() calls are not present, allows to avoid expensive invocation of Babel
  if (!shouldTransformSourceCode(sourceCode, options.modules)) {
    this.callback(null, sourceCode, inputSourceMap);
    return;
  }

  // ⚠ "this._compilation" limits loaders compatibility, however there seems to be no other way to access Webpack's
  // resolver.
  // There is this.resolve(), but it's asynchronous. Another option is to read the webpack.config.js, but it won't work
  // for programmatic usage. This API is used by many loaders/plugins, so hope we're safe for a while
  const resolveOptionsFromWebpackConfig: webpack.ResolveOptions = this._compilation?.options.resolve || {};

  let result: TransformResult | null = null;
  let error: Error | null = null;

  try {
    result = transformSync(sourceCode, {
      filename: path.relative(process.cwd(), this.resourcePath),
      enableSourceMaps: this.sourceMap || false,
      inputSourceMap: parseSourceMap(inputSourceMap),
      pluginOptions: options,
    });
  } catch (err) {
    error = err as Error;
  }

  if (result) {
    this.callback(null, result.code, result.sourceMap);
    return;
  }

  this.callback(error);
}
