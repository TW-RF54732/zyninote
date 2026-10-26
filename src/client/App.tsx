import { Route, Switch } from "wouter";
import { Header } from "./components/Header.tsx";
import { NotePage } from "./pages/NotePage.tsx";
import { RootPage } from "./pages/RootPage.tsx";
import { SubjectPage } from "./pages/SubjectPage.tsx";

export function App() {
  return (
    <>
      <a className="skip-link" href="#content">
        跳到內容
      </a>
      <Header />
      <main className="container" id="content" tabIndex={-1}>
        <Switch>
          <Route path="/">
            <RootPage />
          </Route>
          <Route path="/:subject/:slug">{(params) => <NotePage subject={decodeURIComponent(params.subject)} slug={decodeURIComponent(params.slug)} />}</Route>
          <Route path="/:subject">{(params) => <SubjectPage name={decodeURIComponent(params.subject)} />}</Route>
        </Switch>
      </main>
      <footer className="footer container">
        <span>Zyninote / 有結構的學習筆記</span>
      </footer>
    </>
  );
}
