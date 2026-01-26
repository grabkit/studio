'use client';

import React, { createContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { translateText } from '@/ai/flows/translate-flow';

type Language = 'en' | 'te' | 'hi' | 'es';
type LanguageMap = { [key in Language]: string };

export const languages: LanguageMap = {
    en: 'English',
    te: 'Telugu',
    hi: 'Hindi',
    es: 'Spanish',
};

interface TranslationContextType {
    language: Language;
    setLanguage: (language: Language) => void;
    translate: (text: string) => string;
    isTranslating: boolean;
}

export const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

interface TranslationProviderProps {
    children: ReactNode;
}

export function TranslationProvider({ children }: TranslationProviderProps) {
    const [language, setLanguage] = useState<Language>('en');
    const [translations, setTranslations] = useState<Record<string, string>>({});
    const [isTranslating, setIsTranslating] = useState(false);
    const translationQueue = React.useRef<string[]>([]);

    const processQueue = useCallback(() => {
        if (translationQueue.current.length === 0) {
            setIsTranslating(false);
            return;
        }

        setIsTranslating(true);
        const text = translationQueue.current.shift();
        if (!text) {
            processQueue();
            return;
        }

        const cacheKey = `${language}:${text}`;
        translateText({ text, targetLanguage: languages[language] })
            .then(result => {
                setTranslations(prev => ({...prev, [cacheKey]: result.translatedText}));
            })
            .catch(err => console.error("Translation failed:", err))
            .finally(() => {
                processQueue();
            });
    }, [language]);

    const translate = useCallback((text: string): string => {
        if (language === 'en') {
            return text;
        }

        const cacheKey = `${language}:${text}`;
        if (translations[cacheKey]) {
            return translations[cacheKey];
        }

        if (!translationQueue.current.includes(text)) {
            translationQueue.current.push(text);
        }

        if (!isTranslating) {
            processQueue();
        }

        return text;
    }, [language, translations, isTranslating, processQueue]);

    const value = useMemo(() => ({
        language,
        setLanguage,
        translate,
        isTranslating,
    }), [language, translate, isTranslating]);
    
    return (
        <TranslationContext.Provider value={value}>
            {children}
        </TranslationContext.Provider>
    );
}
