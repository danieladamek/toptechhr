import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from '@/components/Layout';
import { ThemeProvider } from '@/lib/theme';
import { NotebookProvider } from '@/lib/notebook-context';
import { TermDrawerProvider } from '@/components/ui/TermDrawer';
import Start from '@/pages/Start';
import NotFound from '@/pages/NotFound';
import { S } from '@/strings';

// Route-level code splitting: TipTap, docx, KaTeX, the chart library and the search index load only where used.
const Plan = lazy(() => import('@/pages/Plan'));
const ConstraintPage = lazy(() => import('@/pages/ConstraintPage'));
const LeverPage = lazy(() => import('@/pages/LeverPage'));
const ProgramPage = lazy(() => import('@/pages/ProgramPage'));
const Rules = lazy(() => import('@/pages/Rules'));
const GatePage = lazy(() => import('@/pages/GatePage'));
const StatePage = lazy(() => import('@/pages/StatePage'));
const Numbers = lazy(() => import('@/pages/Numbers'));
const Library = lazy(() => import('@/pages/Library'));
const Notebooks = lazy(() => import('@/pages/Notebooks'));
const NotebookPage = lazy(() => import('@/pages/NotebookPage'));
const NotebookPrint = lazy(() => import('@/pages/NotebookPrint'));
const About = lazy(() => import('@/pages/About'));

const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function App() {
  return (
    <ThemeProvider>
      <NotebookProvider>
        <BrowserRouter basename={basename}>
          <TermDrawerProvider>
            <Layout>
              <Suspense fallback={<div className="mx-auto max-w-content px-4 py-12 bx-muted min-h-[80vh]" role="status">{S.loading}</div>}>
                <Routes>
                  <Route path="/" element={<Start />} />
                  <Route path="/plan" element={<Plan />} />
                  <Route path="/plan/constraints/:id" element={<ConstraintPage />} />
                  <Route path="/plan/actions/:id" element={<LeverPage />} />
                  <Route path="/plan/programs/:id" element={<ProgramPage />} />
                  <Route path="/rules" element={<Rules />} />
                  <Route path="/rules/state/:stateId" element={<StatePage />} />
                  <Route path="/rules/:gateId" element={<GatePage />} />
                  <Route path="/numbers" element={<Numbers />} />
                  <Route path="/library" element={<Navigate to="/library/guide" replace />} />
                  <Route path="/library/:tab" element={<Library />} />
                  <Route path="/library/:tab/:itemId" element={<Library />} />
                  <Route path="/notebook" element={<Notebooks />} />
                  <Route path="/notebook/:id" element={<NotebookPage />} />
                  <Route path="/notebook/:id/print" element={<NotebookPrint />} />
                  <Route path="/about" element={<About />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </Layout>
          </TermDrawerProvider>
        </BrowserRouter>
      </NotebookProvider>
    </ThemeProvider>
  );
}
