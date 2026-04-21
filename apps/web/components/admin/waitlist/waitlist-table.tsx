'use client';

import { Github, Linkedin } from 'lucide-react';
import type { WaitlistEntry } from '../../../lib/waitlist/api';
import { courseToLabel } from '../../../lib/waitlist/course';

export function WaitlistTable({ rows }: { rows: WaitlistEntry[] }) {
  if (rows.length === 0) {
    return (
      <p className="font-mono text-xs uppercase tracking-label text-ink-mute py-8 text-center">
        Nenhum inscrito.
      </p>
    );
  }
  return (
    <table className="w-full text-sm font-serif-tool">
      <thead className="text-left">
        <tr className="border-b border-rule">
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
          <tr key={r.id} className="border-b border-rule hover:bg-paper-warm">
            <Td className="font-mono text-xs text-ink-mute tabular-nums">
              {r.createdAt.slice(0, 10)}
            </Td>
            <Td>{r.name}</Td>
            <Td className="text-ink-soft">
              <a href={`mailto:${r.email}`} className="hover:underline">{r.email}</a>
            </Td>
            <Td className="text-ink-soft">{courseToLabel(r.course)}</Td>
            <Td className="font-mono text-xs tabular-nums text-ink-soft">{r.year}º</Td>
            <Td><SkillDots level={r.skillLevel} /></Td>
            <Td>
              <div className="flex gap-2">
                {r.github && (
                  <a href={r.github} target="_blank" rel="noreferrer" className="text-ink-mute hover:text-ink">
                    <Github className="w-4 h-4" strokeWidth={1.5} />
                  </a>
                )}
                {r.linkedin && (
                  <a href={r.linkedin} target="_blank" rel="noreferrer" className="text-ink-mute hover:text-ink">
                    <Linkedin className="w-4 h-4" strokeWidth={1.5} />
                  </a>
                )}
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`font-mono text-[11px] uppercase tracking-label text-ink-mute py-3 pr-3 ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`py-3 pr-3 ${className}`}>{children}</td>;
}

function SkillDots({ level }: { level: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`inline-block w-1.5 h-1.5 rounded-full ${n <= level ? 'bg-ink' : 'bg-rule'}`}
        />
      ))}
    </span>
  );
}
