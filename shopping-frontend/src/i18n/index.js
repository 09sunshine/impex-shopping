import fr from './translations/fr';
import en from './translations/en';
import ht from './translations/ht';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, STORAGE_KEY } from './languages';

export const translations = {
  fr,
  en,
  ht,
};

export { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, STORAGE_KEY };

/**
 * Resolve a dot-notated key e.g. "nav.dashboard" from a translations dictionary.
 */
export function getTranslation(lang, key, fallback = '') {
  const dictionary = translations[lang] || translations[DEFAULT_LANGUAGE] || {};
  const fallbackDict = translations[DEFAULT_LANGUAGE] || {};

  const keys = key.split('.');
  let current = dictionary;
  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = current[k];
    } else {
      current = undefined;
      break;
    }
  }

  if (current !== undefined) return current;

  // Fallback to default language dictionary
  let fb = fallbackDict;
  for (const k of keys) {
    if (fb && typeof fb === 'object' && k in fb) {
      fb = fb[k];
    } else {
      fb = undefined;
      break;
    }
  }

  if (fb !== undefined) return fb;

  return fallback || key;
}
