export const WAITLIST_COURSES = [
  'CIENCIA_COMPUTACAO',
  'ADMINISTRACAO',
  'ENGENHARIA_SOFTWARE',
  'ENGENHARIA_COMPUTACAO',
  'SISTEMAS_INFORMACAO',
] as const;

export type WaitlistCourse = (typeof WAITLIST_COURSES)[number];

const LABEL_TO_ENUM: Record<string, WaitlistCourse> = {
  'Ciência da Computação': 'CIENCIA_COMPUTACAO',
  'Administração': 'ADMINISTRACAO',
  'Engenharia de Software': 'ENGENHARIA_SOFTWARE',
  'Engenharia de Computação': 'ENGENHARIA_COMPUTACAO',
  'Sistemas de Informação': 'SISTEMAS_INFORMACAO',
};

const ENUM_TO_LABEL: Record<WaitlistCourse, string> = Object.fromEntries(
  Object.entries(LABEL_TO_ENUM).map(([label, value]) => [value, label]),
) as Record<WaitlistCourse, string>;

export function labelToCourse(label: string | null | undefined): WaitlistCourse | null {
  if (!label) return null;
  return LABEL_TO_ENUM[label] ?? null;
}

export function courseToLabel(course: WaitlistCourse): string {
  return ENUM_TO_LABEL[course];
}
