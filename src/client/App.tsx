import { Route, Switch, useLocation } from "wouter";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { Header } from "./components/Header.tsx";
import { LinkLayer } from "./components/LinkLayer.tsx";
import { NotePage } from "./pages/NotePage.tsx";
import { ProblemsPage } from "./pages/ProblemsPage.tsx";
import { RootPage } from "./pages/RootPage.tsx";
import { SubjectPage } from "./pages/SubjectPage.tsx";

export function App() {
  const [location] = useLocation();
  return (
    <>
      <a className="skip-link" href="#content">
        跳到內容
      </a>
      <Header />
      <main className="container" id="content" tabIndex={-1}>
        <ErrorBoundary key={location}>
          <Switch>
            <Route path="/">
              <RootPage />
            </Route>
            {/* Subject names never start with "_", so this cannot shadow a subject. */}
            <Route path="/_problems">
              <ProblemsPage />
            </Route>
            <Route path="/:subject/:slug">{(params) => <NotePage subject={decodeURIComponent(params.subject)} slug={decodeURIComponent(params.slug)} />}</Route>
            <Route path="/:subject">{(params) => <SubjectPage name={decodeURIComponent(params.subject)} />}</Route>
          </Switch>
        </ErrorBoundary>
      </main>
      <footer className="footer container">
        <span>Zyninote / 有結構的學習筆記</span>
      </footer>
      <LinkLayer />
    </>
  );
}
