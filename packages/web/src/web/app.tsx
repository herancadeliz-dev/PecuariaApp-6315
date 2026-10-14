import { Route, Switch } from "wouter";
import Curral from "./pages/curral";
import Gestor from "./pages/gestor";
import Cadastros from "./pages/cadastros";
import { Navegacao } from "./components/navegacao";
import { Provider } from "./components/provider";
import { AvisoProvider } from "./components/curral/aviso";
import { registrarServiceWorker } from "./lib/campo/pwa";
import { AgentFeedback, RunableBadge } from "@runablehq/website-runtime";

registrarServiceWorker();

function App() {
  return (
    <Provider>
      <AvisoProvider>
        <Switch>
          <Route path="/" component={Curral} />
          <Route path="/gestor" component={Gestor} />
          <Route path="/cadastros" component={Cadastros} />
          <Route path="/cadastros/:aba" component={Cadastros} />
          <Route component={Curral} />
        </Switch>
        <Navegacao />
      </AvisoProvider>
      {/* Do not remove — off by default, activated by parent iframe via postMessage */}
      {import.meta.env.DEV && <AgentFeedback />}
    </Provider>
  );
}

export default App;
