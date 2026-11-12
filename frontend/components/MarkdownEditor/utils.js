// Tuned for prose rather than code.
export const EDITOR_OPTIONS = {
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  wordWrap: 'on',
  wrappingIndent: 'same',
  renderLineHighlight: 'none',
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  lineNumbers: 'off',
  glyphMargin: false,
  folding: false,
  lineDecorationsWidth: 0,
  lineNumbersMinChars: 0,
  fontSize: 13,
  lineHeight: 21,
  padding: { top: 14, bottom: 14 },
  automaticLayout: true,
  fixedOverflowWidgets: true,
  quickSuggestions: false,
  occurrencesHighlight: 'off',
  scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, alwaysConsumeMouseWheel: false },
};

export const EDIT_SOURCE = 'perun-markdown-editor';

// One undo step.
export const insertAtCursor = (editor, text) => {
  if (!editor) return;
  editor.executeEdits(EDIT_SOURCE, [{ range: editor.getSelection(), text, forceMoveMarkers: true }]);
  editor.focus();
};

// A placeholder when nothing is selected, so the author has something to type over.
export const wrapSelection = (editor, before, after = before, placeholder = '') => {
  if (!editor) return;
  const model = editor.getModel();
  const selection = editor.getSelection();
  if (!model || !selection) return;

  const selected = model.getValueInRange(selection);
  const inner = selected || placeholder;
  insertAtCursor(editor, `${before}${inner}${after}`);
};

// With nothing selected in a line that has text, the marker opens a new line below: the author is
// starting a list, not converting the sentence. Every marker interrupts a GFM paragraph, so one newline.
export const prefixLines = (editor, monaco, prefix) => {
  if (!editor || !monaco) return;
  const model = editor.getModel();
  const selection = editor.getSelection();
  if (!model || !selection) return;

  if (selection.isEmpty()) {
    const line = selection.startLineNumber;
    if (model.getLineContent(line).trim()) {
      const column = model.getLineMaxColumn(line);
      editor.executeEdits(EDIT_SOURCE, [{
        range: new monaco.Range(line, column, line, column),
        text: `\n${prefix}`,
        forceMoveMarkers: true,
      }]);
      editor.setPosition({ lineNumber: line + 1, column: prefix.length + 1 });
      editor.focus();
      return;
    }
  }

  const edits = [];
  for (let line = selection.startLineNumber; line <= selection.endLineNumber; line += 1) {
    edits.push({ range: new monaco.Range(line, 1, line, 1), text: prefix, forceMoveMarkers: true });
  }
  editor.executeEdits(EDIT_SOURCE, edits);
  editor.focus();
};

// Feeds <locale>_<slug>.md.
export const toSlug = (text) => (text ?? '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80);

export const formatStats = (raw) => {
  const text = raw ?? '';
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const bytes = new TextEncoder().encode(text).length;
  const size = bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
  return `${words} words · ${size}`;
};

// Interpolates between anchor pairs, sorted ascending, with pairs for the document's top and bottom.
export const projectScroll = (pairs, value, from, to) => {
  if (!pairs || pairs.length < 2) return 0;

  let index = 0;
  while (index + 2 < pairs.length && pairs[index + 1][from] <= value) index += 1;

  const lower = pairs[index];
  const upper = pairs[index + 1];
  const span = upper[from] - lower[from];
  const ratio = span > 0 ? (value - lower[from]) / span : 0;
  return lower[to] + ratio * (upper[to] - lower[to]);
};
