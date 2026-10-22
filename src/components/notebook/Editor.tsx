import { useEffect, useRef } from 'react';
import { EditorContent, useEditor, type Editor as TEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import LinkExt from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import { PlanRow, QuoteBlock, SectionHeading, SourcesBlock } from './extensions';
import type { Notebook, PMNode } from '@/lib/notebook';
import type { HrTemplateSection } from '@/types';

/**
 * The Notebook editor (KICKOFF §4c): headings, bold, italic, bulleted and numbered lists, task lists, links, block
 * quotes, undo/redo and the usual shortcuts (StarterKit's), a placeholder per template section; no images in v1.
 * The store is the source of truth: typing writes the doc back; a quote or row added from a page arrives as a new doc
 * and is set into the editor.
 */
export default function Editor({ nb, sections, onDoc, compact = false, editable = true }: { nb: Notebook; sections: HrTemplateSection[]; onDoc: (doc: PMNode) => void; compact?: boolean; editable?: boolean }) {
  const onDocRef = useRef(onDoc);
  onDocRef.current = onDoc;
  // the template arrives after the editor is made; the placeholder reads it through a ref
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const placeholderFor = (editor: TEditor, pos: number): string => {
    // the fills_from line of the section the empty paragraph sits in
    let id: string | null = null;
    editor.state.doc.nodesBetween(0, pos, (n) => { if (n.type.name === 'heading' && n.attrs.level === 2) id = (n.attrs.sectionId as string | null) ?? null; return false; });
    return sectionsRef.current.find((s) => s.id === id)?.fills_from ?? '';
  };
  const editor = useEditor({
    editable,
    extensions: [
      StarterKit.configure({ heading: false }),
      SectionHeading.configure({ levels: [1, 2, 3] }),
      LinkExt.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noreferrer', target: '_blank' } }),
      TaskList, TaskItem.configure({ nested: true }),
      Placeholder.configure({ includeChildren: false, showOnlyCurrent: false, placeholder: ({ editor: ed, pos, node }) => (node.type.name === 'paragraph' ? placeholderFor(ed as TEditor, pos) : '') }),
      QuoteBlock, PlanRow, SourcesBlock,
    ],
    content: nb.doc,
    editorProps: { attributes: { 'aria-label': `Notebook: ${nb.title}`, 'data-testid': 'notebook-editor', class: compact ? 'px-1' : 'px-2' } },
    onUpdate: ({ editor: ed }) => onDocRef.current(ed.getJSON() as PMNode),
  }, [nb.id]);

  // a doc changed from outside (a quote, a row, an import) is set into the editor; the editor's own writes compare equal
  // repaint the placeholders once the template has loaded
  useEffect(() => { if (editor && !editor.isDestroyed && sections.length) editor.view.dispatch(editor.state.tr.setMeta('placeholders', true)); }, [editor, sections]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (JSON.stringify(editor.getJSON()) !== JSON.stringify(nb.doc)) editor.commands.setContent(nb.doc as object, false);
  }, [editor, nb.doc]);

  if (!editor) return null;
  const btn = (label: string, on: boolean, run: () => void, title: string) => (
    <button type="button" className={`bx-btn !px-2 !py-1 !text-[11px] ${on ? 'bx-btn-on' : ''}`} aria-pressed={on} title={title} aria-label={title} onMouseDown={(e) => e.preventDefault()} onClick={run}>{label}</button>
  );
  const link = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link address', prev ?? 'https://');
    if (url === null) return;
    if (!url) editor.chain().focus().unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };
  return (
    <div className="tt-editor">
      {editable && (
        <div className="flex flex-wrap gap-1 mb-2 no-print" role="toolbar" aria-label="Formatting">
          {btn('H2', editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'Heading')}
          {btn('H3', editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), 'Subheading')}
          {btn('B', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'Bold (⌘B)')}
          {btn('I', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'Italic (⌘I)')}
          {btn('• List', editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), 'Bulleted list')}
          {btn('1. List', editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), 'Numbered list')}
          {btn('☐ Tasks', editor.isActive('taskList'), () => editor.chain().focus().toggleTaskList().run(), 'Task list')}
          {btn('Link', editor.isActive('link'), link, 'Link')}
          {btn('❝', editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), 'Block quote')}
          {btn('↶', false, () => editor.chain().focus().undo().run(), 'Undo (⌘Z)')}
          {btn('↷', false, () => editor.chain().focus().redo().run(), 'Redo (⇧⌘Z)')}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
