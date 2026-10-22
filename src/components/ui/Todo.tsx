/** Amber TODO(author) marker — a pending fact is shown, labelled, and never hidden or filled (APP-SPEC §6). */
export default function Todo({ children }: { children: React.ReactNode }) {
  return <span className="bx-todo" data-todo="author">TODO(author): {children}</span>;
}
