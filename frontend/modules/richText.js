/**
 * TipTap (ProseMirror) for RichTextEditor and RichTextView, loaded by `loadRichText` on first use.
 * No React here: the editor mounts into a node the component owns, and the toolbar is the bundle's.
 */
export { Editor, getSchema } from '@tiptap/core';
export { DOMParser as SchemaParser, DOMSerializer as SchemaSerializer } from '@tiptap/pm/model';
export { default as StarterKit } from '@tiptap/starter-kit';
export { default as Image } from '@tiptap/extension-image';
export { TableKit } from '@tiptap/extension-table';
export { Placeholder } from '@tiptap/extensions';
