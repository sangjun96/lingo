export const languages = {
	en: { label: '영어', name: 'English', tag: 'en', badge: 'EN' },
	es: { label: '스페인어', name: 'Spanish', tag: 'es', badge: 'ES' },
	zh: { label: '중국어', name: 'Mandarin Chinese', tag: 'zh-CN', badge: 'ZH' },
	fr: { label: '프랑스어', name: 'French', tag: 'fr', badge: 'FR' },
	ru: { label: '러시아어', name: 'Russian', tag: 'ru', badge: 'RU' },
} as const;

export type Language = keyof typeof languages;
export const DEFAULT_LANGUAGE: Language = 'en';
export function isLanguage(value: unknown): value is Language {
	return typeof value === 'string' && Object.hasOwn(languages, value);
}
