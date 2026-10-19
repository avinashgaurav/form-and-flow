/** Web preview: the browser's own localStorage. */
export const authStorage: Storage | undefined = typeof window !== 'undefined' ? window.localStorage : undefined;
