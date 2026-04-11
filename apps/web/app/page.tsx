import { GraduationCap } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-8 w-8" aria-hidden="true" />
        <h1 className="text-4xl font-semibold tracking-tight">ICS Select</h1>
      </div>
      <p className="max-w-xl text-lg text-foreground/70">
        Programa de Preparação Avançada para Entrevistas Técnicas — Inteli Consulting Society.
      </p>
      <p className="text-sm text-foreground/50">Em breve.</p>
    </main>
  );
}
