import { Link } from 'react-router-dom';
import { S } from '@/strings';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-content px-4 lg:px-14 py-16 min-h-[60vh]">
      <h1 className="text-[34px]">{S.notFoundH1}</h1>
      <p className="mt-3 text-[18px]">{S.notFoundLead}</p>
      <p className="mt-6 flex flex-wrap items-center gap-5"><Link className="bx-btn-primary" to="/">{S.backToStart}</Link><Link className="bx-btn-text" to="/library">{S.nav.library}</Link></p>
    </div>
  );
}
