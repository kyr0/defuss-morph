import df$ from 'defuss-query';
import { createDomI18n } from './core.js';
export { I18N_CHANGE_EVENT, I18N_VERSION, PLURAL_CATEGORIES, TRANSLATABLE_ATTRIBUTES, assertValidI18n, canonicalLocale, chooseAttribute, createI18n, localeChain, localeDirection, ownedElements, parseTranslationAttribute, resolveLocale, validateI18n } from './core.js';

const bindI18n = (...args) => createDomI18n(df$).bind(...args);
const mountI18n = (...args) => createDomI18n(df$).mount(...args);

export { bindI18n, createDomI18n, mountI18n };
//# sourceMappingURL=index.js.map
