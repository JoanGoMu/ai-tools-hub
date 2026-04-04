'use client';

import { useEffect, useState } from 'react';

const LANGUAGE_NAMES: Record<string, string> = {
  es: 'español',
  fr: 'français',
  de: 'Deutsch',
  pt: 'português',
  it: 'italiano',
  nl: 'Nederlands',
  pl: 'polski',
  ru: 'русский',
  ja: '日本語',
  ko: '한국어',
  zh: '中文',
  ar: 'العربية',
  hi: 'हिन्दी',
  tr: 'Türkçe',
  sv: 'svenska',
  da: 'dansk',
  fi: 'suomi',
  nb: 'norsk',
};

export default function TranslateBanner() {
  const [lang, setLang] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('translate-dismissed')) return;
    const primary = navigator.language?.split('-')[0].toLowerCase();
    if (primary && primary !== 'en' && LANGUAGE_NAMES[primary]) {
      setLang(primary);
    }
  }, []);

  if (!lang || dismissed) return null;

  const langName = LANGUAGE_NAMES[lang];
  const path = window.location.pathname;
  const translateUrl = `https://aitoolcrunch-com.translate.goog${path}?_x_tr_sl=en&_x_tr_tl=${lang}&_x_tr_hl=en&_x_tr_pto=wapp`;

  function dismiss() {
    sessionStorage.setItem('translate-dismissed', '1');
    setDismissed(true);
  }

  return (
    <div className="bg-indigo-600 text-white text-sm px-4 py-2 flex items-center justify-between gap-4">
      <span>
        This page is available in{' '}
        <a
          href={translateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-semibold hover:text-indigo-200"
        >
          {langName}
        </a>{' '}
        via Google Translate.
      </span>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 text-indigo-200 hover:text-white text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}
