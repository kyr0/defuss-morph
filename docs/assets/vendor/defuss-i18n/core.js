const I18N_VERSION = "0.2.0";
function canonicalLocale(locale) {
  if (typeof locale !== "string" || !locale.trim()) throw new RangeError("defuss-i18n: locale must be a non-empty BCP 47 tag");
  return Intl.getCanonicalLocales(locale)[0];
}
function localeChain(locale, fallback = ["en"]) {
  const result = [];
  const add = (tag) => {
    const canonical = canonicalLocale(tag);
    if (!result.includes(canonical)) result.push(canonical);
    const parts = new Intl.Locale(canonical).baseName.split("-");
    while (parts.length) {
      const candidate = parts.join("-");
      if (!result.includes(candidate)) result.push(candidate);
      parts.pop();
    }
  };
  add(locale);
  fallback.forEach(add);
  return result;
}
function resolveLocale(available, locale, fallback = ["en"]) {
  const tags = new Set(Array.from(available, canonicalLocale));
  return localeChain(locale, fallback).find((tag) => tags.has(tag));
}
function localeDirection(locale) {
  const tag = new Intl.Locale(canonicalLocale(locale));
  const native = typeof tag.getTextInfo === "function" ? tag.getTextInfo() : tag.textInfo;
  if (native) return native.direction;
  const rtlScripts = /* @__PURE__ */ new Set(["Adlm", "Arab", "Armi", "Avst", "Elym", "Hatr", "Hebr", "Hung", "Khar", "Lydi", "Mand", "Mani", "Mend", "Merc", "Mero", "Narb", "Nbat", "Nkoo", "Orkh", "Ougr", "Palm", "Phli", "Phlp", "Phnx", "Prti", "Rohg", "Samr", "Sarb", "Sogd", "Sogo", "Syrc", "Thaa", "Yezi"]);
  return rtlScripts.has(tag.maximize().script ?? "") ? "rtl" : "ltr";
}
function createI18n(options = {}) {
  const fallback = Object.freeze(Array.from(new Set(
    (typeof options.fallback === "string" ? [options.fallback] : options.fallback ?? ["en"]).map(canonicalLocale)
  )));
  const direction = options.direction ?? localeDirection;
  const makeSnapshot = (locale, revision) => {
    const dir = direction(locale);
    if (dir !== "ltr" && dir !== "rtl") throw new TypeError("defuss-i18n: direction must be ltr or rtl");
    return Object.freeze({ locale, revision, fallback, direction: dir });
  };
  let snapshot = makeSnapshot(canonicalLocale(options.locale ?? "en"), 0);
  let disposed = false;
  let notifying = false;
  let request = 0;
  let pending;
  const listeners = /* @__PURE__ */ new Map();
  const assertLive = () => {
    if (disposed) throw new Error("defuss-i18n: controller is disposed");
  };
  const assertWritable = () => {
    assertLive();
    if (notifying) throw new Error("defuss-i18n: reentrant locale changes are unsupported; schedule a microtask");
  };
  const invalidateLoad = () => {
    request++;
    pending?.abort();
    pending = void 0;
  };
  const publish = (locale, force = false) => {
    if (!force && locale === snapshot.locale) return snapshot;
    const next = makeSnapshot(locale, snapshot.revision + 1);
    snapshot = next;
    notifying = true;
    const errors = [];
    const batch = Array.from(listeners);
    try {
      for (const phase of ["render", "notify"]) {
        for (const [listener, registeredPhase] of batch) {
          if (registeredPhase !== phase || !listeners.has(listener)) continue;
          try {
            listener(next);
          } catch (error) {
            errors.push(error);
          }
        }
      }
    } finally {
      notifying = false;
    }
    if (errors.length) throw new AggregateError(errors, "defuss-i18n: locale committed, but one or more subscribers failed");
    return next;
  };
  const api = {
    get snapshot() {
      return snapshot;
    },
    get locale() {
      return snapshot.locale;
    },
    get disposed() {
      return disposed;
    },
    setLocale(locale) {
      assertWritable();
      const tag = canonicalLocale(locale);
      invalidateLoad();
      return publish(tag);
    },
    refresh() {
      assertWritable();
      invalidateLoad();
      return publish(snapshot.locale, true);
    },
    subscribe(listener, opts = {}) {
      assertLive();
      if (listeners.has(listener)) throw new Error("defuss-i18n: listener already subscribed");
      listeners.set(listener, opts.phase ?? "notify");
      if (opts.immediate) {
        try {
          listener(snapshot);
        } catch (error) {
          listeners.delete(listener);
          throw error;
        }
      }
      return () => {
        listeners.delete(listener);
      };
    },
    resolveLocale(available, requested = snapshot.locale) {
      return resolveLocale(available, requested, fallback);
    },
    directionFor(locale = snapshot.locale) {
      const dir = direction(canonicalLocale(locale));
      if (dir !== "ltr" && dir !== "rtl") throw new TypeError("defuss-i18n: direction must be ltr or rtl");
      return dir;
    },
    formatNumber(value, opts) {
      return new Intl.NumberFormat(snapshot.locale, opts).format(value);
    },
    formatDate(value, opts) {
      return new Intl.DateTimeFormat(snapshot.locale, opts).format(value);
    },
    plural(value, opts) {
      return new Intl.PluralRules(snapshot.locale, opts).select(value);
    },
    async loadLocale(locale, load, commit) {
      assertWritable();
      const tag = canonicalLocale(locale);
      invalidateLoad();
      const ticket = request;
      const controller = new AbortController();
      pending = controller;
      let data;
      try {
        data = await load(tag, controller.signal);
      } catch (error) {
        if (disposed || ticket !== request) return { status: "superseded", snapshot };
        pending = void 0;
        throw error;
      }
      if (disposed || ticket !== request) return { status: "superseded", snapshot };
      pending = void 0;
      const committed = commit?.(data);
      if (committed && typeof committed.then === "function") throw new TypeError("defuss-i18n: load commit must be synchronous");
      if (disposed || ticket !== request) return { status: "superseded", snapshot };
      return { status: "applied", snapshot: publish(tag, true) };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      invalidateLoad();
      listeners.clear();
    }
  };
  return api;
}

const TRANSLATABLE_ATTRIBUTES = Object.freeze([
  "aria-roledescription",
  "aria-description",
  "aria-placeholder",
  "aria-valuetext",
  "aria-label",
  "placeholder",
  "download",
  "srcset",
  "poster",
  "title",
  "sizes",
  "label",
  "alt",
  "src",
  "href",
  "content"
]);
const ordered = [...TRANSLATABLE_ATTRIBUTES].sort((a, b) => b.length - a.length);
function parseTranslationAttribute(name) {
  if (!name.startsWith("data-i18n-")) return void 0;
  const rest = name.slice(10);
  for (const attribute of ordered) {
    const prefix = `${attribute}-`;
    if (rest.startsWith(prefix)) return { attribute, locale: canonicalLocale(rest.slice(prefix.length)) };
  }
  return void 0;
}
function chooseAttribute(variants, locale, fallback) {
  for (const tag of localeChain(locale, fallback)) if (variants.has(tag)) return variants.get(tag);
  return void 0;
}

const controls = /* @__PURE__ */ new Set(["component", "target", "for", "locale", "plural", "count", "value"]);
const PLURAL_CATEGORIES = /* @__PURE__ */ new Set(["zero", "one", "two", "few", "many", "other"]);
function ownedElements(root) {
  return [root, ...root.querySelectorAll("*")].filter((element) => {
    const boundary = element.closest("[data-i18n-component]");
    return element === root || boundary === root || !boundary || !root.contains(boundary);
  });
}
function validateI18n(root, options = {}) {
  const issues = [];
  const report = (code, message, element) => {
    issues.push({ code, message, element });
  };
  const targets = /* @__PURE__ */ new Map();
  const variants = /* @__PURE__ */ new Map();
  const identities = /* @__PURE__ */ new Map();
  const elements = ownedElements(root);
  const tree = root.getRootNode();
  const byId = (id) => "getElementById" in tree ? tree.getElementById(id) : [tree, ...tree.querySelectorAll("[id]")].find((element) => element.id === id) ?? null;
  const validateContent = (element) => {
    const translations = /* @__PURE__ */ new Map();
    const record = (attribute, locale) => {
      const locales = translations.get(attribute) ?? /* @__PURE__ */ new Set();
      if (locales.has(locale)) report("CONFLICTING_ATTRIBUTE", `conflicting ${attribute}/${locale} variants`, element);
      locales.add(locale);
      translations.set(attribute, locales);
    };
    for (const attr of element.attributes) {
      if (!attr.name.startsWith("data-i18n-")) continue;
      const suffix = attr.name.slice(10);
      if (controls.has(suffix)) continue;
      if (suffix.startsWith("remove-")) {
        let locale;
        try {
          locale = canonicalLocale(suffix.slice(7));
        } catch {
          report("INVALID_LOCALE", `Invalid locale in ${attr.name}`, element);
          continue;
        }
        for (const name of attr.value.split(/\s+/).filter(Boolean)) {
          if (!parseTranslationAttribute(`data-i18n-${name}-en`)) report("UNSUPPORTED_ATTRIBUTE", `Cannot localize ${name}`, element);
          else record(name, locale);
        }
        continue;
      }
      try {
        const parsed = parseTranslationAttribute(attr.name);
        if (!parsed) report("UNSUPPORTED_ATTRIBUTE", `Unknown or non-content translation attribute ${attr.name}`, element);
        else record(parsed.attribute, parsed.locale);
      } catch {
        report("INVALID_LOCALE", `Invalid locale in ${attr.name}`, element);
      }
    }
    for (const [attribute, locales] of translations) {
      for (const locale of options.locales ?? []) {
        if (!locales.has(canonicalLocale(locale))) report("MISSING_ATTRIBUTE_LOCALE", `${attribute} lacks ${canonicalLocale(locale)}`, element);
      }
    }
    const value = element.getAttribute("data-i18n-value");
    if (value !== null && (!value || options.values && !options.values.includes(value))) {
      report("UNKNOWN_VALUE", `Missing declared interpolation value ${value}`, element);
    }
  };
  for (const element of elements) {
    validateContent(element);
    const target = element.getAttribute("data-i18n-target");
    if (target !== null) {
      if (!target) report("EMPTY_TARGET", "Translation targets need a non-empty name", element);
      if (targets.has(target)) report("DUPLICATE_TARGET", `Duplicate target ${target}`, element);
      targets.set(target, element);
      if (element.localName === "template") report("INVALID_TARGET", "A template cannot be a live translation target", element);
      if (element.querySelector("[data-i18n-component]")) report("NESTED_OWNERSHIP", `Target ${target} contains another component`, element);
      const ancestor = element.parentElement?.closest("[data-i18n-target]");
      if (ancestor && root.contains(ancestor)) {
        report("OVERLAPPING_TARGET", "Translation targets must not overlap", element);
      }
    }
    const sourceFor = element.getAttribute("data-i18n-for");
    if (sourceFor === null) continue;
    if (element.localName !== "template") {
      report("INVALID_SOURCE", "Translation sources must be template elements", element);
      continue;
    }
    let locale;
    try {
      locale = canonicalLocale(element.getAttribute("data-i18n-locale") ?? "");
    } catch {
      report("INVALID_LOCALE", "Template needs a valid data-i18n-locale", element);
      continue;
    }
    const plural = element.getAttribute("data-i18n-plural") ?? "";
    if (plural && !PLURAL_CATEGORIES.has(plural)) report("INVALID_PLURAL", `Invalid plural category ${plural}`, element);
    const key = `${locale}:${plural}`;
    const entries = variants.get(sourceFor) ?? /* @__PURE__ */ new Set();
    if (entries.has(key)) report("DUPLICATE_VARIANT", `Duplicate ${sourceFor}/${key}`, element);
    entries.add(key);
    variants.set(sourceFor, entries);
    const content = element.content;
    if (content.querySelector("template")) report("NESTED_TEMPLATE", "Nested templates are not supported by the morph peer", element);
    if (content.querySelector("[data-i18n-component], [data-i18n-target]")) report("NESTED_OWNERSHIP", "Sources cannot introduce nested localization ownership", element);
    const ids = /* @__PURE__ */ new Set();
    const keys = /* @__PURE__ */ new Set();
    const group = `${sourceFor}:${plural}`;
    const seenIdentities = identities.get(group) ?? /* @__PURE__ */ new Map();
    for (const child of content.querySelectorAll("*")) {
      validateContent(child);
      if (child.id) {
        if (ids.has(child.id)) report("DUPLICATE_ID", `Duplicate source id ${child.id}`, child);
        ids.add(child.id);
      }
      const siblingKey = child.getAttribute("key");
      const identityKeys = child.id ? [`id:${child.id}`] : [];
      if (siblingKey !== null) {
        const ancestry = [];
        let parent = child.parentElement;
        while (parent) {
          const siblings = Array.from(parent.parentNode?.childNodes ?? []).filter((node) => node.nodeType === 1);
          ancestry.unshift(parent.id ? `id:${parent.id}` : parent.hasAttribute("key") ? `key:${parent.getAttribute("key")}` : `${parent.localName}:${siblings.indexOf(parent)}`);
          parent = parent.parentElement;
        }
        identityKeys.push(`key:${ancestry.join("/")}/${siblingKey}`);
      }
      for (const identity of identityKeys) {
        const previousTag = seenIdentities.get(identity);
        if (previousTag && previousTag !== child.localName) report("IDENTITY_TAG_MISMATCH", `${identity} changes tag from ${previousTag} to ${child.localName}`, child);
        else seenIdentities.set(identity, child.localName);
      }
      if (siblingKey !== null) {
        const siblings = Array.from(child.parentNode?.childNodes ?? []).filter((node) => node.nodeType === 1);
        if (siblings.filter((sibling) => sibling.getAttribute("key") === siblingKey).length > 1 && !keys.has(siblingKey)) {
          report("DUPLICATE_KEY", `Duplicate sibling key ${siblingKey}`, child);
          keys.add(siblingKey);
        }
      }
    }
    identities.set(group, seenIdentities);
    for (const child of content.querySelectorAll("[aria-labelledby], [aria-describedby], label[for]")) {
      for (const attr of ["aria-labelledby", "aria-describedby", "for"]) {
        for (const id of (child.getAttribute(attr) ?? "").split(/\s+/).filter(Boolean)) {
          const existing = byId(id);
          const liveTarget = elements.find((element2) => element2.getAttribute("data-i18n-target") === sourceFor);
          const external = existing && (existing === liveTarget || !liveTarget?.contains(existing));
          if (!ids.has(id) && !external) report("MISSING_ID_REFERENCE", `Unresolved ${attr} reference ${id}`, child);
        }
      }
    }
  }
  for (const [name, target] of targets) {
    const entries = variants.get(name);
    if (!entries?.size) report("MISSING_SOURCE", `Target ${name} has no templates`, target);
    const count = target.getAttribute("data-i18n-count");
    if (count !== null && (!count || options.values && !options.values.includes(count))) report("UNKNOWN_VALUE", `Missing plural count ${count}`, target);
    for (const locale of options.locales ?? []) {
      const canonical = canonicalLocale(locale);
      const plain = entries?.has(`${canonical}:`);
      const other = entries?.has(`${canonical}:other`);
      if (count !== null ? !other : !plain) report("MISSING_LOCALE", `Target ${name} lacks ${canonical}${count !== null ? "/other" : ""}`, target);
    }
    if (entries) {
      const localeTags = new Set(Array.from(entries, (entry) => entry.split(":")[0]));
      for (const locale of localeTags) {
        const hasPlural = Array.from(entries).some((entry) => entry.startsWith(`${locale}:`) && !entry.endsWith(":"));
        if (count === null && hasPlural) report("MISSING_COUNT", `Plural variants for ${name} require data-i18n-count`, target);
        if (count !== null && (!entries.has(`${locale}:other`) || entries.has(`${locale}:`))) {
          report("INVALID_PLURAL_SET", `${name}/${locale} requires other and no unqualified variant`, target);
        }
      }
    }
  }
  for (const name of variants.keys()) if (!targets.has(name)) report("MISSING_TARGET", `Templates refer to missing target ${name}`, root);
  for (const element of elements.filter((element2) => element2.localName === "template" && element2.hasAttribute("data-i18n-for"))) {
    const sourceFor = element.getAttribute("data-i18n-for");
    const target = targets.get(sourceFor);
    if (target?.contains(element)) report("SOURCE_INSIDE_TARGET", `Template for ${sourceFor} would be removed by its own morph`, element);
  }
  return issues;
}
function assertValidI18n(root, options) {
  const issues = validateI18n(root, options);
  if (issues.length) throw new Error(`defuss-i18n: invalid component
${issues.map((issue) => `${issue.code}: ${issue.message}`).join("\n")}`);
}

const I18N_CHANGE_EVENT = "defuss-i18n:change";
const bindings = /* @__PURE__ */ new WeakMap();
const RAW_TEXT = /* @__PURE__ */ new Set(["script", "style", "xmp", "iframe", "noembed", "noframes", "noscript", "plaintext"]);
function assertValues(values) {
  for (const [key, value] of Object.entries(values)) {
    if (!["string", "number", "boolean"].includes(typeof value)) throw new TypeError(`defuss-i18n: ${key} must be a primitive interpolation value`);
  }
}
function interpolatePlan(elements, values) {
  return elements.flatMap((element) => {
    const key = element.getAttribute("data-i18n-value");
    if (key === null) return [];
    if (!Object.hasOwn(values, key)) throw new Error(`defuss-i18n: missing interpolation value ${key}`);
    if (element.children.length) throw new Error(`defuss-i18n: interpolation slot ${key} must contain text only`);
    if (RAW_TEXT.has(element.localName)) throw new Error(`defuss-i18n: interpolation slot ${key} cannot be a raw-text <${element.localName}>`);
    return [{ element, value: String(values[key]) }];
  });
}
function attributePlan(elements, snapshot) {
  const writes = [];
  for (const element of elements) {
    if (element.localName === "template") continue;
    const variants = /* @__PURE__ */ new Map();
    const add = (name, locale, value) => {
      const map = variants.get(name) ?? /* @__PURE__ */ new Map();
      if (map.has(locale)) throw new Error(`defuss-i18n: conflicting ${name}/${locale} variants`);
      map.set(locale, value);
      variants.set(name, map);
    };
    for (const attr of element.attributes) {
      const parsed = parseTranslationAttribute(attr.name);
      if (parsed) add(parsed.attribute, parsed.locale, attr.value);
      else if (attr.name.startsWith("data-i18n-remove-")) {
        const locale = canonicalLocale(attr.name.slice(17));
        for (const name of attr.value.split(/\s+/).filter(Boolean)) {
          if (!TRANSLATABLE_ATTRIBUTES.includes(name)) throw new Error(`defuss-i18n: cannot remove localized ${name}`);
          add(name, locale, null);
        }
      }
    }
    for (const [name, translations] of variants) {
      const selected = localeChain(snapshot.locale, snapshot.fallback).find((locale) => translations.has(locale));
      if (!selected) throw new Error(`defuss-i18n: no ${name} variant for ${snapshot.locale}`);
      writes.push({ element, name, value: translations.get(selected) });
    }
  }
  return writes;
}
function createDomI18n(runtime) {
  if (typeof runtime !== "function" || typeof runtime.morph !== "function") {
    throw new Error("defuss-i18n: load defuss-morph and defuss-query (or defuss-shadcn core.js) first");
  }
  const writeAttributes = (writes) => {
    for (const { element, name, value } of writes) {
      if (value === null) {
        if (element.hasAttribute(name)) runtime(element).attr(name, null);
      } else if (element.getAttribute(name) !== value) runtime(element).attr(name, value);
    }
  };
  const writeTexts = (writes) => {
    for (const { element, value } of writes) if (element.textContent !== value) runtime(element).text(value);
  };
  function bind(root, controller, options = {}) {
    if (!root || root.nodeType !== 1) throw new TypeError("defuss-i18n: bind requires an Element");
    const existing = bindings.get(root);
    if (existing && !existing.disposed) throw new Error("defuss-i18n: component already bound; reuse or dispose its binding");
    existing?.dispose();
    if (controller.disposed) throw new Error("defuss-i18n: controller is disposed");
    let regions = [];
    let disposed = false;
    let refreshing = false;
    let overrideValues;
    let context;
    let unsubscribe = () => {
    };
    const assertLive = () => {
      if (disposed || controller.disposed) throw new Error("defuss-i18n: binding or controller is disposed");
    };
    const scan = () => {
      if (options.render) {
        if (root.querySelector("[data-i18n-component]")) throw new Error("defuss-i18n: full renderer cannot own nested components");
        regions = [];
        return;
      }
      assertValidI18n(root);
      const elements = ownedElements(root);
      const sources = elements.filter((element) => element.localName === "template" && element.hasAttribute("data-i18n-for"));
      regions = elements.filter((element) => element.hasAttribute("data-i18n-target")).map((target) => ({
        name: target.getAttribute("data-i18n-target"),
        target,
        sources: sources.filter((source) => source.getAttribute("data-i18n-for") === target.getAttribute("data-i18n-target")).map((source) => ({
          locale: canonicalLocale(source.getAttribute("data-i18n-locale")),
          plural: source.getAttribute("data-i18n-plural") ?? "",
          // Capture once. Switching never consumes/moves/mutates authoring sources.
          template: source.cloneNode(true)
        }))
      }));
    };
    const refresh = () => {
      assertLive();
      if (refreshing) throw new Error("defuss-i18n: reentrant binding refresh");
      refreshing = true;
      try {
        const EventConstructor = root.ownerDocument.defaultView?.CustomEvent;
        if (!EventConstructor) throw new Error("defuss-i18n: component document needs a CustomEvent constructor");
        const snapshot = controller.snapshot;
        const state = options.getState?.();
        const values = overrideValues ?? (typeof options.values === "function" ? options.values(state, snapshot) : options.values ?? {});
        assertValues(values);
        const nextContext = Object.freeze({ state, values, snapshot, locale: snapshot.locale, i18n: controller, root, query: runtime });
        const plans = [];
        if (options.render) {
          if (root.querySelector("[data-i18n-component]")) throw new Error("defuss-i18n: full renderer cannot own nested components");
          const html = options.render(nextContext);
          if (typeof html !== "string") throw new TypeError("defuss-i18n: renderer must return an HTML string synchronously");
          const container = root.ownerDocument.createElement("template");
          container.innerHTML = html;
          if (container.content.querySelector("[data-i18n-component], template")) throw new Error("defuss-i18n: renderer cannot introduce nested components or templates");
          const children = Array.from(container.content.querySelectorAll("*"));
          writeAttributes(attributePlan(children, snapshot));
          writeTexts(interpolatePlan(children, values));
          plans.push({ target: root, html: container.innerHTML, locale: snapshot.locale, direction: snapshot.direction });
        } else {
          for (const region of regions) {
            if (region.target !== root && !root.contains(region.target)) throw new Error("defuss-i18n: target was replaced; call binding.rescan()");
            const selectedLocale = controller.resolveLocale(region.sources.map((source2) => source2.locale));
            if (!selectedLocale) throw new Error(`defuss-i18n: no template for ${region.name}/${snapshot.locale}`);
            const countKey = region.target.getAttribute("data-i18n-count");
            let category = "";
            if (countKey !== null) {
              const count = values[countKey];
              if (typeof count !== "number" || !Number.isFinite(count)) throw new TypeError(`defuss-i18n: plural count ${countKey} must be a finite number`);
              category = new Intl.PluralRules(selectedLocale).select(count);
            }
            const source = region.sources.find((item) => item.locale === selectedLocale && item.plural === category) ?? region.sources.find((item) => item.locale === selectedLocale && item.plural === "other");
            if (!source) throw new Error(`defuss-i18n: missing ${region.name}/${selectedLocale}/${category} variant`);
            const clone = source.template.cloneNode(true);
            const children = Array.from(clone.content.querySelectorAll("*"));
            writeAttributes(attributePlan(children, snapshot));
            writeTexts(interpolatePlan(children, values));
            plans.push({ target: region.target, html: clone.innerHTML, locale: selectedLocale, direction: options.reflectLocale === false ? snapshot.direction : controller.directionFor(selectedLocale) });
          }
        }
        const owned = ownedElements(root).filter(
          (element) => element.localName !== "template" && !plans.some((plan) => plan.target !== element && plan.target.contains(element))
        );
        const attrs = attributePlan(owned, snapshot);
        const texts = interpolatePlan(owned.filter((element) => !plans.some((plan) => plan.target === element)), values);
        for (const plan of plans) {
          runtime(plan.target).html(plan.html);
          if (options.reflectLocale !== false) {
            runtime(plan.target).attr("lang", plan.locale);
            runtime(plan.target).attr("dir", plan.direction);
          }
        }
        writeAttributes(attrs);
        writeTexts(texts);
        if (options.reflectLocale !== false && !plans.some((plan) => plan.target === root)) {
          runtime(root).attr("lang", snapshot.locale);
          runtime(root).attr("dir", snapshot.direction);
        }
        context = nextContext;
        const rendered = options.afterRender?.(nextContext);
        if (rendered && typeof rendered.then === "function") throw new TypeError("defuss-i18n: afterRender must be synchronous");
        const target = options.eventTarget ?? root;
        target.dispatchEvent(new EventConstructor(I18N_CHANGE_EVENT, { detail: Object.freeze({ snapshot, root }), bubbles: true }));
      } finally {
        refreshing = false;
      }
    };
    const api = {
      root,
      controller,
      get disposed() {
        return disposed || controller.disposed;
      },
      get context() {
        return context;
      },
      refresh,
      setValues(values) {
        assertLive();
        assertValues(values);
        const previous = overrideValues;
        overrideValues = Object.freeze({ ...values });
        try {
          refresh();
        } catch (error) {
          if (context?.values !== overrideValues) overrideValues = previous;
          throw error;
        }
      },
      rescan() {
        assertLive();
        scan();
        refresh();
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        unsubscribe();
        if (bindings.get(root) === api) bindings.delete(root);
      }
    };
    try {
      bindings.set(root, api);
      scan();
      runtime(root).attr("data-i18n-component", root.getAttribute("data-i18n-component") ?? "");
      unsubscribe = controller.subscribe(refresh, { phase: "render" });
      refresh();
    } catch (error) {
      api.dispose();
      throw error;
    }
    return api;
  }
  function mount(scope, controller) {
    const roots = Array.from(scope.querySelectorAll("[data-i18n-component]"));
    if (scope.nodeType === 1 && scope.hasAttribute("data-i18n-component")) roots.unshift(scope);
    const mounted = [];
    try {
      for (const root of roots) mounted.push(bind(root, controller));
    } catch (error) {
      mounted.forEach((binding) => binding.dispose());
      throw error;
    }
    return { bindings: Object.freeze(mounted), dispose() {
      mounted.forEach((binding) => binding.dispose());
    } };
  }
  return Object.freeze({ bind, mount });
}

export { I18N_CHANGE_EVENT, I18N_VERSION, PLURAL_CATEGORIES, TRANSLATABLE_ATTRIBUTES, assertValidI18n, canonicalLocale, chooseAttribute, createDomI18n, createI18n, localeChain, localeDirection, ownedElements, parseTranslationAttribute, resolveLocale, validateI18n };
//# sourceMappingURL=core.js.map
