import { Eyebrow } from '../../../components/ui/eyebrow';

export default function MemberPlaceholderHome() {
  return (
    <section className="max-w-2xl">
      <Eyebrow>ICS Select</Eyebrow>
      <h1 className="mt-3 font-serif text-4xl font-medium leading-tight tracking-tight">
        Your study home is being rebuilt.
      </h1>
      <p className="mt-4 font-sans text-base leading-relaxed text-ink-soft">
        The member experience is under construction. The daily list, item focus page, and cohort
        view all ship in the next release. For anything urgent, reach out to the program director.
      </p>
      <p className="mt-6 font-mono text-[11px] uppercase tracking-label text-ink-mute">
        PR 2a · foundation preview
      </p>
    </section>
  );
}
