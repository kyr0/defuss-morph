import { bindI18n, createI18n } from "defuss-i18n";

// one controller for the page; each bound component follows its locale
const locale = createI18n({ locale: "en", fallback: ["en"] });

export function mountWithI18n(app: HTMLElement) {
  bindI18n(app.querySelector<HTMLElement>("[data-i18n-component]")!, locale);
  app.addEventListener("click", (event) => {
    const tag = (event.target as Element).closest<HTMLElement>("[data-locale]")?.dataset.locale;
    if (tag) locale.setLocale(tag);
  });
}
