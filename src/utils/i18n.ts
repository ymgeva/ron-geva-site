// i18n utilities
export const languages = {
  en: 'English',
  he: 'עברית',
};

export const defaultLang = 'en';

export const ui = {
  en: {
    'nav.home': 'Home',
    'nav.art': 'Art',
    'nav.blog': 'Blog',
    'nav.about': 'About',
    'nav.book': 'Book',
    'nav.alligators': 'Alligators',
    'art.color': 'Color',
    'art.portraits': 'Portraits',
    'art.bw': 'Black & White',
    'art.sculptures': 'Sculptures',
    'art.postcards': 'Postcards',
  },
  he: {
    'nav.home': 'בית',
    'nav.art': 'אמנות',
    'nav.blog': 'בלוג',
    'nav.about': 'אודות',
    'nav.book': 'ספר',
    'nav.alligators': 'תנינים',
    'art.color': 'צבעוני',
    'art.portraits': 'דיוקנאות',
    'art.bw': 'שחור לבן',
    'art.sculptures': 'פסלים',
    'art.postcards': 'גלויות',
  },
} as const;

export function getLangFromUrl(url: URL) {
  const [, lang] = url.pathname.split('/');
  if (lang in languages) return lang as keyof typeof languages;
  return defaultLang;
}

export function useTranslations(lang: keyof typeof languages) {
  return function t(key: keyof (typeof ui)[typeof defaultLang]) {
    return ui[lang][key] || ui[defaultLang][key];
  };
}

export function useTranslatedPath(lang: keyof typeof languages) {
  return function translatePath(path: string, l: string = lang) {
    return `/${l}${path}`;
  };
}
