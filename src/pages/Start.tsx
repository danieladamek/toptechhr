import { Link } from 'react-router-dom';
import StartSteps from '@/components/StartSteps';
import { S } from '@/strings';

/** The one small pale line illustration (KICKOFF §4e): two figures over a laptop with a check mark. Decorative. */
function Illustration() {
  return (
    <svg viewBox="0 0 320 220" className="w-full max-w-[340px]" aria-hidden="true" focusable="false" fill="none" stroke="#9CC4E4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="104" cy="52" r="20" />
      <path d="M68 132c0-24 16-44 36-44s36 20 36 44" />
      <circle cx="216" cy="52" r="20" />
      <path d="M180 132c0-24 16-44 36-44s36 20 36 44" />
      <rect x="86" y="118" width="148" height="70" rx="8" fill="var(--bx-surface)" />
      <path d="M62 196h196" />
      <path d="M140 154l14 14 28-30" stroke="#2A7FBF" strokeWidth="5" />
    </svg>
  );
}

export default function Start() {
  return (
    <div className="mx-auto max-w-content px-4 lg:px-14 py-10 sm:py-16">
      <section className="grid items-center gap-8 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]" aria-labelledby="start-h1">
        <div>
          <h1 id="start-h1" className="text-[34px] sm:text-[46px] leading-[1.1]">{S.heroTitle}</h1>
          <p className="mt-4 max-w-[46ch] text-[18px]">{S.heroLead}</p>
          <div className="mt-7 flex flex-wrap items-center gap-6">
            <Link to="/plan" className="bx-btn-primary" data-testid="show-plan">{S.showPlan}</Link>
            <Link to="/rules" className="bx-btn-text">{S.browseRules}</Link>
          </div>
        </div>
        <div className="hidden md:flex justify-center"><Illustration /></div>
      </section>
      <section className="tt-section" aria-label="The four steps">
        <StartSteps />
        <div className="mt-8"><Link to="/plan" className="bx-btn-primary">{S.showPlan}</Link></div>
      </section>
    </div>
  );
}
