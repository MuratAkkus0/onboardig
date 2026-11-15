// `server-only` throws unless the `react-server` condition applies. Node scripts run outside
// Next, so resolve it to an empty module. (Do not use --conditions=react-server: it also swaps
// react/react-dom for their server builds and breaks react-email's render.)
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,", shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
