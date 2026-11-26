/**
 * Catálogo de departamentos didácticos para selectores.
 * La API guarda el departamento como texto libre; esta lista solo facilita la elección.
 */
export const DEPARTAMENTOS = [
  'Informática',
  'Matemáticas',
  'Lengua Castellana',
  'Inglés',
  'Geografía e Historia',
  'Física y Química',
  'Biología y Geología',
  'Educación Física',
  'Orientación',
] as const

/** Lista sin duplicados que incluye valores extra (p. ej. el departamento del usuario). */
export function departamentosCon(...extra: (string | null | undefined)[]): string[] {
  const set = new Set<string>(DEPARTAMENTOS)
  for (const e of extra) if (e) set.add(e)
  return [...set].sort((a, b) => a.localeCompare(b, 'es'))
}
