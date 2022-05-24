import type { NodePath, PluginObj, PluginPass, types as t } from '@babel/core';
import { types } from '@babel/core';
import { declare } from '@babel/helper-plugin-utils';
import hash from '@emotion/hash';
import { BabelPluginOptions } from './types';
import { validateOptions } from './validateOptions';
import * as findUp from 'find-up';
import { dirname, relative } from 'path';
import { readFileSync } from 'fs';
import {
  CONTEXT_SELECTOR_PACKAGE,
  CREATE_CONTEXT_CALL,
  GLOBAL_CONTEXT_CALL,
  GLOBAL_CONTEXT_PACKAGE,
  GLOBAL_CONTEXT_SELECTOR_CALL,
  GLOBAL_CONTEXT_SELECTOR_PACKAGE,
  REACT_PACKAGE,
} from './constants';

type BabelPluginState = PluginPass & {
  importDeclarationPaths?: NodePath<t.ImportDeclaration>[];
  nativeExpressionPaths?: NodePath<t.CallExpression>[];
  contextSelectorExpressionPaths?: NodePath<t.CallExpression>[];
  nativeLocalName?: string;
  contextSelectorLocalName?: string;
};

interface PackageJSON {
  name: string;
  version: string;
}

/**
 * Checks that passed callee imports react context or context selector
 */
function isCreateContextCallee(
  path: NodePath<t.Expression | t.V8IntrinsicIdentifier>,
  state: Pick<BabelPluginState, 'nativeLocalName' | 'contextSelectorLocalName'>,
): path is NodePath<t.Identifier> {
  if (!path.isIdentifier) {
    return false;
  }

  if (state.nativeLocalName && path.referencesImport(REACT_PACKAGE, CREATE_CONTEXT_CALL)) {
    return true;
  }

  if (state.contextSelectorLocalName && path.referencesImport(CONTEXT_SELECTOR_PACKAGE, CREATE_CONTEXT_CALL)) {
    return true;
  }

  return false;
}

function createGlobalContextImportDeclaration(packageName: string, functionName: string) {
  return types.importDeclaration(
    [types.importSpecifier(types.identifier(functionName), types.identifier(CREATE_CONTEXT_CALL))],
    types.stringLiteral(packageName),
  );
}

function createGlobalContextCallExpression(options: {
  expressionPath: NodePath<t.CallExpression>;
  packageJson: PackageJSON;
  packageJsonPath: string;
  filePath: string;
  functionName: string;
}) {
  const { expressionPath, packageJson, packageJsonPath, filePath, functionName } = options;

  const args = expressionPath.get('arguments').map(arg => arg.node);
  if (!expressionPath.parentPath.isVariableDeclarator()) {
    return expressionPath.node;
  }

  // Use the relative path from package.json because the same package
  // can be installed under different paths in node_modules if they are duplicated
  const relativePath = relative(packageJsonPath, filePath);
  const id = expressionPath.parentPath.get('id') as NodePath<babel.types.Identifier>;
  return types.callExpression(types.identifier(functionName), [
    ...args,
    types.stringLiteral(hash(`${relativePath}@${id.node.name}`)),
    types.stringLiteral(packageJson.name),
    types.stringLiteral(packageJson.version),
  ]);
}

/**
 * Checks if import statement import createContext().
 */
function hasReactImport(path: NodePath<babel.types.ImportDeclaration>): boolean {
  return path.node.source.value === 'react';
}

function hasContextSelectorImport(path: NodePath<babel.types.ImportDeclaration>): boolean {
  return path.node.source.value === '@fluentui/react-context-selector';
}

export const transformPlugin = declare<Partial<BabelPluginOptions>, PluginObj<BabelPluginState>>((api, options) => {
  api.assertVersion(7);

  const pluginOptions: Required<BabelPluginOptions> = {
    modules: [
      { moduleSource: 'react', importName: 'createContext' },
      { moduleSource: '@fluentui/react-context-selector', importName: 'createContext' },
    ],
    ...options,
  };

  validateOptions(pluginOptions);

  return {
    name: 'global-context',

    pre() {
      this.importDeclarationPaths = [];
      this.nativeExpressionPaths = [];
      this.contextSelectorExpressionPaths = [];
    },

    visitor: {
      Program: {
        enter() {},

        exit(path, state) {
          if (state.filename === undefined) {
            return;
          }
          const packageJsonPath = findUp.sync('package.json', { cwd: dirname(state.filename) });
          if (packageJsonPath === undefined) {
            return;
          }
          if (!state.importDeclarationPaths?.length) {
            return;
          }

          if (state.importDeclarationPaths.some(hasReactImport)) {
            // Adds import for global context
            path.unshiftContainer(
              'body',
              createGlobalContextImportDeclaration(GLOBAL_CONTEXT_PACKAGE, GLOBAL_CONTEXT_CALL),
            );
          }

          if (state.importDeclarationPaths.some(hasContextSelectorImport)) {
            // Adds import for global context
            path.unshiftContainer(
              'body',
              createGlobalContextImportDeclaration(GLOBAL_CONTEXT_SELECTOR_PACKAGE, GLOBAL_CONTEXT_SELECTOR_CALL),
            );
          }

          const packageJson: PackageJSON = JSON.parse(readFileSync(packageJsonPath).toString());
          // substitutes expressions of react createContext to global context
          if (state.contextSelectorExpressionPaths) {
            for (const expressionPath of state.contextSelectorExpressionPaths) {
              expressionPath.replaceWith(
                createGlobalContextCallExpression({
                  expressionPath,
                  packageJson,
                  packageJsonPath,
                  filePath: state.filename,
                  functionName: GLOBAL_CONTEXT_SELECTOR_CALL,
                }),
              );
            }
          }

          if (state.nativeExpressionPaths) {
            for (const expressionPath of state.nativeExpressionPaths) {
              expressionPath.replaceWith(
                createGlobalContextCallExpression({
                  expressionPath,
                  packageJson,
                  packageJsonPath,
                  filePath: state.filename,
                  functionName: GLOBAL_CONTEXT_CALL,
                }),
              );
            }
          }
        },
      },

      // eslint-disable-next-line @typescript-eslint/naming-convention
      ImportDeclaration(path, state) {
        let native = false;
        if (hasReactImport(path)) {
          native = true;
          state.importDeclarationPaths!.push(path);
        }

        if (hasContextSelectorImport(path)) {
          native = false;
          state.importDeclarationPaths!.push(path);
        }

        for (const importSpecifier of path.node.specifiers) {
          if (
            types.isImportSpecifier(importSpecifier) &&
            types.isIdentifier(importSpecifier.imported) &&
            types.isIdentifier(importSpecifier.local) &&
            !importSpecifier.local.name.startsWith('__')
          ) {
            const localName = importSpecifier.local.name;
            if (native) {
              state.nativeLocalName = localName;
            } else {
              state.contextSelectorLocalName = localName;
            }
          }
        }
      },
      // eslint-disable-next-line @typescript-eslint/naming-convention
      CallExpression(path, state) {
        /**
         * Handles case when `createContext()` is `CallExpression`.
         *
         * @example createContext({})
         */
        if (state.importDeclarationPaths!.length === 0) {
          return;
        }

        const calleePath = path.get('callee');

        if (!isCreateContextCallee(calleePath, state)) {
          return;
        }

        if (types.isCallExpression(path.node) && types.isIdentifier(path.node.callee)) {
          if (path.node.callee.name === state.nativeLocalName) {
            state.nativeExpressionPaths!.push(path);
          }
          if (path.node.callee.name === state.contextSelectorLocalName) {
            state.contextSelectorExpressionPaths!.push(path);
          }
        }
      },

      // eslint-disable-next-line @typescript-eslint/naming-convention
      MemberExpression(expressionPath, state) {
        /**
         * Handles case when `createContext()` is inside `MemberExpression`.
         * Assumes that context selector is not used this way
         *
         * @example module.createContext({})
         */

        const objectPath = expressionPath.get('object');
        const propertyPath = expressionPath.get('property');

        const isCreateContextCall =
          objectPath.isIdentifier({ name: 'React' }) && propertyPath.isIdentifier({ name: 'createContext' });

        if (!isCreateContextCall) {
          return;
        }

        const parentPath = expressionPath.parentPath;

        if (!parentPath.isCallExpression()) {
          return;
        }
        state.nativeExpressionPaths?.push(parentPath);
      },
    },
  };
});
