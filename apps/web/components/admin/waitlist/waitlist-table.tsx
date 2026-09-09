'use client';

import { Github, Linkedin } from 'lucide-react';
import type { WaitlistEntry } from '../../../lib/waitlist/api';
import { courseToLabel } from '../../../lib/waitlist/course';

export function WaitlistTable({ rows }: { rows: WaitlistEntry[] }) {
  if (rows.length === 0) {
    return (
      <p className="font-sans text-xs font-medium text-fg-mute py-8 text-center">
        Nenhum inscrito.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-card border border-border-token bg-surface px-4">
    <table className="w-full min-w-[760px] whitespace-nowrap text-sm font-sans">
      <thead className="text-left bg-bg-subtle">
        <tr className="border-b border-border-token">
          <Th className="w-24">Data</Th>
          <Th>Nome</Th>
          <Th>Email</Th>
          <Th>Curso</Th>
          <Th className="w-16">Ano</Th>
          <Th className="w-24">Skill</Th>
          <Th className="w-20">Links</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-border-token hover:bg-bg-subtle">
            <Td className="font-mono text-xs text-fg-mute tabular-nums">
              {r.createdAt.slice(0, 10)}
            </Td>
            <Td>{r.name}</Td>
            <Td className="text-fg-soft">
              <a href={`mailto:${r.email}`} className="hover:underline">{r.email}</a>
            </Td>
            <Td className="text-fg-soft">{courseToLabel(r.course)}</Td>
            <Td className="font-mono text-xs tabular-nums text-fg-soft">{r.year}º</Td>
            <Td><SkillDots level={r.skillLevel} /></Td>
            <Td>
              <div className="flex gap-2">
                {r.github && (
                  <a href={r.github} target="_blank" rel="noreferrer" className="text-fg-mute hover:text-fg">
                    <Github className="w-4 h-4" strokeWidth={1.5} />
                  </a>
                )}
                {r.linkedin && (
                  <a href={r.linkedin} target="_blank" rel="noreferrer" className="text-fg-mute hover:text-fg">
                    <Linkedin className="w-4 h-4" strokeWidth={1.5} />
                  </a>
                )}
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`font-sans text-xs font-medium text-fg-mute py-3 pr-3 ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`py-3 pr-3 ${className}`}>{children}</td>;
}

function SkillDots({ level }: { level: number }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`Skill ${level} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`inline-block w-1.5 h-1.5 rounded-full ${n <= level ? 'bg-primary' : 'bg-border-token'}`}
        />
      ))}
    </span>
  );
}
