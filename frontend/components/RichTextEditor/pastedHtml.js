// What Word, and Outlook, which uses Word's engine, mark their clipboard HTML with.
const WORD_HTML = /urn:schemas-microsoft-com:office|class=["']?Mso|mso-[a-z-]+\s*:|<o:p[\s>]/i;
const DATA_IMAGE = /<img[^>]+src=["']?data:image\//i;
const LIST_STYLE = /mso-list:\s*(l\d+)\s+level(\d+)/i;
const ORDERED_MARKER = /^\(?(\d+|[a-z]|[ivxlcdm]+)[.)]/i;
const COMMENT_NODES = 128;

export const isWordHtml = (html) => WORD_HTML.test(html ?? '');

/** A group's own text, with the groups nested in it left out. */
const topLevelText = (group) => {
  let depth = 0;
  let text = '';
  for (let at = 0; at < group.length; at += 1) {
    const char = group[at];
    if (char === '\\') {
      if (depth === 0) text += char + (group[at + 1] ?? '');
      at += 1;
    } else if (char === '{') {
      // A group ends the control word before it, as a space would.
      if (depth === 0) text += ' ';
      depth += 1;
    } else if (char === '}') depth -= 1;
    else if (depth === 0) text += char;
  }
  return text;
};

const hexBytes = (hex) => Uint8Array.from({ length: hex.length >> 1 }, (_, at) => parseInt(hex.substr(at * 2, 2), 16));

// Word's HTML points its images at a temporary folder the page can't read; the pictures are only in the
// RTF, as hex in {\pict} groups. A \nonshppict repeats one for older readers.
export const rtfImages = (rtf) => {
  const images = [];
  if (!rtf) return images;
  let at = rtf.indexOf('{\\pict');
  while (at !== -1) {
    let depth = 0;
    let end = at;
    for (; end < rtf.length; end += 1) {
      if (rtf[end] === '\\') end += 1;
      else if (rtf[end] === '{') depth += 1;
      else if (rtf[end] === '}' && --depth === 0) break;
    }
    const group = rtf.slice(at + 1, end);
    const type = group.includes('\\pngblip') ? 'image/png' : group.includes('\\jpegblip') ? 'image/jpeg' : null;
    if (type && !/\\nonshppict\s*$/.test(rtf.slice(Math.max(0, at - 16), at))) {
      const hex = /\\[a-z]+-?\d*\s?([\da-f\s]+)$/i.exec(topLevelText(group))?.[1].replace(/\s+/g, '') ?? '';
      if (hex.length >= 8) images.push({ type, bytes: hexBytes(hex) });
    }
    at = rtf.indexOf('{\\pict', end);
  }
  return images;
};

const fileOf = (bytes, type, index) =>
  new File([bytes], `pasted-${index + 1}.${type === 'image/jpeg' ? 'jpg' : type.split('/')[1].replace('+xml', '')}`, { type });

const dataImage = (src, index) => {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(src.trim());
  if (!match) return null;
  try {
    return fileOf(Uint8Array.from(atob(match[2]), char => char.charCodeAt(0)), match[1].toLowerCase(), index);
  } catch {
    return null;
  }
};

const removeMarker = (marker) => {
  let node = marker;
  while (node?.parentElement && node.parentElement.tagName === 'SPAN' && !node.parentElement.textContent.replace(node.textContent, '').trim()) {
    node = node.parentElement;
  }
  node?.remove();
};

// Word writes a list as paragraphs, the level in the style and the marker as text.
const convertLists = (doc, body) => {
  const items = [...body.querySelectorAll('p')]
    .map(p => ({ p, match: LIST_STYLE.exec(p.getAttribute('style') ?? '') }))
    .filter(item => item.match)
    .map(item => ({ ...item, next: item.p.nextElementSibling }));

  let stack = [];
  items.forEach(({ p, match }, index) => {
    const previous = items[index - 1];
    if (!previous || previous.next !== p || previous.match[1] !== match[1]) stack = [];

    const level = Number(match[2]);
    const marker = p.querySelector('[style*="mso-list:Ignore"]');
    const ordered = ORDERED_MARKER.test((marker?.textContent ?? '').replace(/[\s ]/g, ''));
    removeMarker(marker);

    while (stack.length && stack[stack.length - 1].level > level) stack.pop();
    let top = stack[stack.length - 1];
    if (!top || top.level < level) {
      const list = doc.createElement(ordered ? 'ol' : 'ul');
      if (top) top.item.appendChild(list); else p.before(list);
      top = { list, level, item: null };
      stack.push(top);
    }

    const li = doc.createElement('li');
    p.removeAttribute('style');
    p.removeAttribute('class');
    li.appendChild(p);
    top.list.appendChild(li);
    top.item = li;
  });
};

// Images the page can't load (Word's local files, data: URLs) go to keepImage(file), which answers a src
// or null to leave the image out.
export const cleanPastedHtml = (html, { rtf, keepImage } = {}) => {
  const word = isWordHtml(html);
  if (!word && !DATA_IMAGE.test(html ?? '')) return { html, dropped: 0 };

  const doc = new window.DOMParser().parseFromString(html, 'text/html');
  const { body } = doc;
  let dropped = 0;

  if (word) {
    const walker = doc.createTreeWalker(body, COMMENT_NODES);
    const comments = [];
    while (walker.nextNode()) comments.push(walker.currentNode);
    comments.forEach(comment => comment.remove());
    [...body.getElementsByTagName('o:p')].forEach(element => element.remove());
    convertLists(doc, body);
  }

  const local = [...body.querySelectorAll('img')].filter(img => /^file:/i.test(img.getAttribute('src') ?? ''));
  // Matched to the RTF's pictures by position, which only holds when both counted the same images.
  const pictures = rtfImages(rtf);
  local.forEach((img, index) => {
    const picture = pictures.length === local.length ? pictures[index] : null;
    const src = picture ? keepImage?.(fileOf(picture.bytes, picture.type, index)) : null;
    if (src) img.setAttribute('src', src);
    else {
      img.remove();
      dropped += 1;
    }
  });

  [...body.querySelectorAll('img[src^="data:"]')].forEach((img, index) => {
    const file = dataImage(img.getAttribute('src'), local.length + index);
    const src = file ? keepImage?.(file) : null;
    if (src) img.setAttribute('src', src);
    else {
      img.remove();
      dropped += 1;
    }
  });

  return { html: body.innerHTML, dropped };
};
