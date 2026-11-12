// No React here: the editor mounts into a node the component owns.
export { Editor, getSchema } from '@tiptap/core';
export { DOMParser as SchemaParser, DOMSerializer as SchemaSerializer } from '@tiptap/pm/model';
export { default as StarterKit } from '@tiptap/starter-kit';
export { Paragraph } from '@tiptap/extension-paragraph';
export { Code } from '@tiptap/extension-code';
export { ListItem, OrderedList } from '@tiptap/extension-list';
export { default as Image } from '@tiptap/extension-image';
export { Table, TableKit } from '@tiptap/extension-table';
export { Placeholder } from '@tiptap/extensions';
export { Markdown } from '@tiptap/markdown';
export { Marked } from 'marked';
