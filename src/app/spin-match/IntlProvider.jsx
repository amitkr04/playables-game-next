"use client";
import { NextIntlClientProvider } from "next-intl";
import { useEffect, useState } from "react";

export default function IntlProvider({ children }) {
  const [locale, setLocale] = useState("en");
  const [messages, setMessages] = useState(null);

  const loadLang = async (lang) => {
    try {
      const msg = (await import(`@/languages/${lang}.json`)).default;
      setLocale(lang);
      setMessages(msg);
    } catch {
      const msg = (await import(`@/languages/en.json`)).default;
      setLocale("en");
      setMessages(msg);
    }
  };

  useEffect(() => {
    const browser = navigator.language?.split("-")[0]?.toLowerCase() || "en";
    const initialLang =
      (typeof window !== "undefined" && window.appLanguage) || browser;

    loadLang(initialLang);

    const handleLangChange = (event) => {
      const newLang = event?.detail?.lang || window.appLanguage || "en";
      loadLang(newLang);
    };

    window.addEventListener("languageChanged", handleLangChange);

    return () =>
      window.removeEventListener("languageChanged", handleLangChange);
  }, []);

  if (!messages) return null;

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
