// The website's demos, bundled by `make build` (scripts/lib/demos.ts) into docs/assets/demos.js. The package imports
// stay bare: index.html's import map resolves them to the built defuss-morph and the copies in docs/assets/vendor/.
// Not shown on the page (the code blocks show the demo modules). VERIFIED: scripts/e2e/browser.mjs drives every demo
// mounted here.
import { mountBench } from "./bench-ui";
import { mountCartHtml } from "./cart-html";
import { mountCartJsx } from "./cart-jsx";
import { mountCartQuery } from "./cart-query.js";
import { mountForwardRef } from "./forward-ref";
import { mountQueryRefs } from "./query-refs.js";
import { mountRef } from "./ref";
import { mountWithI18n } from "./with-i18n";
import { mountWithQuery } from "./with-query.js";
import { mountWithStore } from "./with-store";

const byId = (id: string) => document.getElementById(id)!;

mountCartJsx(byId("live-cart-jsx"));
mountCartHtml(byId("live-cart-html"));
mountCartQuery();
mountRef(byId("live-ref"));
mountForwardRef(byId("live-forward-ref"));
mountQueryRefs();
mountWithQuery();
mountWithStore(byId("live-store"));
mountWithI18n(byId("live-i18n"));
mountBench(byId("bench"));
