import { morph } from "defuss-morph";
import { type RouteRequest, createRouter } from "defuss-dom-router";

const bar = document.querySelector<HTMLElement>("[data-ref=bar]")!;
const outlet = document.querySelector<HTMLElement>("[data-ref=outlet]")!;

const esc = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// `current`: "page" in the app's nav, "true" for the view's tabs
const link = (href: string, label: string, current: false | "page" | "true") =>
  `<a data-router-link href="${href}" class="btn" data-size="sm" data-variant="${current ? "secondary" : "ghost"}"${current ? ` aria-current="${current}"` : ""}>${label}</a>`;

// the frame shows no address bar: this one shows the URL the router wrote,
// the page's path and, after the #, the route
const renderBar = (to: RouteRequest) => `
    <output class="address" aria-label="Address">${esc(to.pathname)}<b>#${esc(to.path + to.search + to.hash)}</b></output>
    <nav class="dm-row" aria-label="Demo app">
      ${link("#/", "Projects", to.routeId === "home" && "page")}
      ${link("#/projects/7", "Project 7", to.params.id === "7" && "page")}
      ${link("#/projects/8", "Project 8", to.params.id === "8" && "page")}
    </nav>`;

// a view is markup; the root key names the record, so another project gets
// a fresh note field while switching tabs keeps what you typed
const views: Record<string, (params: Record<string, string>, tab: string) => string> = {
  home: () => `<section key="home"><h2>Projects</h2><p>Open project 7 or 8.</p></section>`,
  project: (params, tab) => {
    const id = esc(params.id); // params come from the URL: escape them like any user input
    return `
      <section key="project-${id}">
        <h2>Project ${id}</h2>
        <nav class="dm-row">
          ${link(`#/projects/${id}?tab=files`, "files", tab === "files" && "true")}
          ${link(`#/projects/${id}?tab=notes`, "notes", tab === "notes" && "true")}
        </nav>
        <p>Showing ${tab}.</p>
        <input class="input" placeholder="note on project ${id}" aria-label="Note">
      </section>`;
  },
  missing: () => `<section key="missing"><h2>Not found</h2></section>`,
};

const router = createRouter({
  mode: "hash",
  routes: [
    { id: "home", path: "/" },
    { id: "project", path: "/projects/:id" },
    { id: "missing", path: "*" },
  ],
  // the router catches what prepare() and commit() throw; show it
  onError: (error) => console.error(`router: ${error.code}: ${error.message}`),
  prepare: ({ to }) => {
    const tab = to.query.find(([key]) => key === "tab")?.[1] === "notes" ? "notes" : "files";
    const markup = views[to.routeId ?? "missing"](to.params, tab);
    return {
      commit: () => {
        morph(outlet, markup);
        morph(bar, renderBar(to));
      },
    };
  },
});

router.attachLinks(document);
await router.start();
