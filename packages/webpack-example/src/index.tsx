import React from 'react';
import { render } from 'react-dom';
import { ProviderContext as ProviderContextV1 } from './fake_node_modules/context-v1.0.0';
import { ProviderContext as ProviderContextV11 } from './fake_node_modules/context-v1.1.0';
import { ProviderContext as ProviderContextV2 } from './fake_node_modules/context-v2.0.0';
import { ProviderContext as SpecialContext } from './fake_node_modules/ignored-context';

const root = document.getElementById('root');

/**
 * In this example both 1.0.0 and 1.1.0 contexts should share the same value
 * You should be able to run `Object.getOwnPropertySymbols(window) and find two separate entries
 * there: one for v1 context and one for v2 context
 */
function Example() {
  const ctx = React.useContext(ProviderContextV1);
  const ctxV11 = React.useContext(ProviderContextV11);
  const ctxV2 = React.useContext(ProviderContextV2);
  const ignoredContext = React.useContext(SpecialContext);
  return (
    <>
      <pre>1.0.0: {JSON.stringify(ctx)}</pre>
      <pre>1.1.0: {JSON.stringify(ctxV11)}</pre>
      <pre>2.0.0: {JSON.stringify(ctxV2)}</pre>
      <pre>ignored: {JSON.stringify(ignoredContext)}</pre>
    </>
  );
}

function App() {
  return (
    <ProviderContextV1.Provider value={{ foo: 'red', bar: 'blue' }}>
      <ProviderContextV2.Provider value={{ bar: 'white', baz: 'black' }}>
        <Example />
      </ProviderContextV2.Provider>
    </ProviderContextV1.Provider>
  );
}

render(<App />, root);
