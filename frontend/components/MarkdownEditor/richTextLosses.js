// A line break survives the round trip, as a hard break; other raw HTML does not.
const LINE_BREAK = /^<br\s*\/?>$/i;

// 'html' for raw HTML and 'tasks' for task list checkboxes.
export const richTextLosses = (tokens) => {
  const found = new Set();
  const visit = (list = []) => list.forEach((token) => {
    if (token.type === 'html' && !LINE_BREAK.test(token.raw.trim())) found.add('html');
    if (token.task) found.add('tasks');
    visit(token.tokens);
    visit(token.items);
    if (token.type === 'table') [...token.header, ...token.rows.flat()].forEach(cell => visit(cell.tokens));
  });
  visit(tokens);
  return ['html', 'tasks'].filter(kind => found.has(kind));
};
