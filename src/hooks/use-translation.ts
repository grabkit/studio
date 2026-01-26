'use client';

import { useContext } from 'react';
import { TranslationContext } from '@/providers/translation-provider';

export function useTranslation() {
    const context = useContext(TranslationContext);
    if (context === undefined) {
        throw new Error('useTranslation must be used within a TranslationProvider');
    }
    return context;
}
