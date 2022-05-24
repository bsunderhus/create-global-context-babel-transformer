import type { TransformOptions } from '@babel/core';

export type BabelPluginOptions = {
  /** Defines set of modules and imports handled by a transformPlugin. */
  modules?: { moduleSource: string; importName: string }[];
};
