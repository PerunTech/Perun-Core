import React from 'react';
import PropTypes from 'prop-types';
import Icon from '../../elements/util/Icon';

// `run` takes a command chain and adds the tool's command to it, so the same function both applies
// the tool and asks whether it can apply (`editor.can().chain()`), which is what disables it.
export const TOOLS = {
  undo: { icon: 'IconArrowBackUp', label: 'undo', run: c => c.undo() },
  redo: { icon: 'IconArrowForwardUp', label: 'redo', run: c => c.redo() },
  heading2: {
    icon: 'IconH2', label: 'heading', run: c => c.toggleHeading({ level: 2 }), active: ['heading', { level: 2 }],
  },
  heading3: {
    icon: 'IconH3', label: 'subheading', run: c => c.toggleHeading({ level: 3 }), active: ['heading', { level: 3 }],
  },
  bold: { icon: 'IconBold', label: 'bold', run: c => c.toggleBold(), active: ['bold'] },
  italic: { icon: 'IconItalic', label: 'italic', run: c => c.toggleItalic(), active: ['italic'] },
  underline: { icon: 'IconUnderline', label: 'underline', run: c => c.toggleUnderline(), active: ['underline'] },
  strike: { icon: 'IconStrikethrough', label: 'strike', run: c => c.toggleStrike(), active: ['strike'] },
  code: { icon: 'IconCode', label: 'code', run: c => c.toggleCode(), active: ['code'] },
  link: { icon: 'IconLink', label: 'link', active: ['link'] },
  bulletList: { icon: 'IconList', label: 'bullet_list', run: c => c.toggleBulletList(), active: ['bulletList'] },
  orderedList: {
    icon: 'IconListNumbers', label: 'numbered_list', run: c => c.toggleOrderedList(), active: ['orderedList'],
  },
  blockquote: { icon: 'IconBlockquote', label: 'quote', run: c => c.toggleBlockquote(), active: ['blockquote'] },
  codeBlock: { icon: 'IconSourceCode', label: 'code_block', run: c => c.toggleCodeBlock(), active: ['codeBlock'] },
  horizontalRule: { icon: 'IconSeparatorHorizontal', label: 'horizontal_rule', run: c => c.setHorizontalRule() },
  clear: { icon: 'IconClearFormatting', label: 'clear', run: c => c.unsetAllMarks().clearNodes() },
  image: { icon: 'IconPhotoPlus', label: 'image' },
  table: {
    icon: 'IconTablePlus', label: 'table', run: c => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }),
  },
  addRowAfter: { icon: 'IconRowInsertBottom', label: 'add_row', run: c => c.addRowAfter() },
  addColumnAfter: { icon: 'IconColumnInsertRight', label: 'add_column', run: c => c.addColumnAfter() },
  deleteRow: { icon: 'IconRowRemove', label: 'delete_row', run: c => c.deleteRow() },
  deleteColumn: { icon: 'IconColumnRemove', label: 'delete_column', run: c => c.deleteColumn() },
  deleteTable: { icon: 'IconTableOff', label: 'delete_table', run: c => c.deleteTable() },
};

// Shown after the rest while the caret is in a table, on a toolbar that offers tables at all.
const TABLE_TOOLS = ['addRowAfter', 'addColumnAfter', 'deleteRow', 'deleteColumn', 'deleteTable'];

export const DEFAULT_TOOLBAR = [
  'undo', 'redo', '|',
  'heading2', 'heading3', '|',
  'bold', 'italic', 'underline', 'strike', 'code', 'link', '|',
  'bulletList', 'orderedList', 'blockquote', 'horizontalRule', '|',
  'table', 'image', 'clear',
];

// Groups of known tools, '|' between them; unknown names are skipped, and so is the image
// tool on an editor that has nowhere to upload to.
const groupsOf = (toolbar, canInsertImage) => toolbar
  .reduce((groups, name) => {
    if (name === '|') groups.push([]);
    else if (TOOLS[name] && (name !== 'image' || canInsertImage)) groups[groups.length - 1].push(name);
    return groups;
  }, [[]])
  .filter(group => group.length);

const RichTextToolbar = ({ editor, toolbar, fmt, linkOpen, onLink, onImage, canInsertImage, uploading }) => {
  const button = (name) => {
    const tool = TOOLS[name];
    const active = name === 'link' ? linkOpen || editor.isActive('link') : tool.active && editor.isActive(...tool.active);
    let disabled = false;
    if (tool.run) disabled = !tool.run(editor.can().chain().focus()).run();
    if (name === 'image') disabled = uploading;
    // A table in a cell is allowed by the schema, but is never what the button was pressed for.
    if (name === 'table' && editor.isActive('table')) disabled = true;

    const onClick = name === 'link' ? onLink
      : name === 'image' ? onImage
        : () => tool.run(editor.chain().focus()).run();

    return (
      <button
        key={name}
        type='button'
        className={`rte-tool${active ? ' is-active' : ''}`}
        title={fmt(tool.label)}
        aria-label={fmt(tool.label)}
        aria-pressed={tool.active ? Boolean(active) : undefined}
        disabled={disabled}
        // Keeps the selection in the document, which a click on the button would otherwise take.
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClick}
      >
        <Icon name={name === 'image' && uploading ? 'IconLoader2' : tool.icon} size={17} stroke={1.6} />
      </button>
    );
  };

  return (
    <div className='rte-toolbar' role='toolbar' style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
      {[
        ...groupsOf(toolbar, canInsertImage),
        ...(toolbar.includes('table') && editor.isActive('table') ? [TABLE_TOOLS] : []),
      ].map((group) => (
        <div key={group.join()} className='rte-tool-group' style={{ display: 'flex', alignItems: 'center' }}>
          {group.map(button)}
        </div>
      ))}
    </div>
  );
};

RichTextToolbar.propTypes = {
  editor: PropTypes.object.isRequired,
  toolbar: PropTypes.arrayOf(PropTypes.string).isRequired,
  fmt: PropTypes.func.isRequired,
  linkOpen: PropTypes.bool,
  onLink: PropTypes.func.isRequired,
  onImage: PropTypes.func.isRequired,
  canInsertImage: PropTypes.bool,
  uploading: PropTypes.bool,
};

export default RichTextToolbar;
