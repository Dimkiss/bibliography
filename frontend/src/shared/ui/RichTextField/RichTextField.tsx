import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Underline from '@tiptap/extension-underline';

import styles from './RichTextField.module.css';

type ToolbarButtonProps = {
  label: string;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

type RichTextFieldProps = {
  value: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onChange: (nextValue: string) => void;
};

function ToolbarButton({
  label,
  title,
  active = false,
  disabled = false,
  onClick,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className={[styles.toolbarButton, active ? styles.toolbarButtonActive : '']
        .filter(Boolean)
        .join(' ')}
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function RichTextField({
  value,
  label,
  placeholder,
  disabled = false,
  className = '',
  onChange,
}: RichTextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
      }),
      Subscript,
      Superscript,
      Underline,
    ],
    content: value || '',
    editable: !disabled,
    editorProps: {
      attributes: {
        class: styles.editor,
      },
      handleDOMEvents: {
        focus: () => {
          setIsFocused(true);
          return false;
        },
        blur: () => {
          setIsFocused(false);
          return false;
        },
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.isEmpty ? '' : editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor || value === editor.getHTML()) {
      return;
    }

    editor.commands.setContent(value || '', { emitUpdate: false });
  }, [editor, value]);

  const canUseToolbar = Boolean(editor) && !disabled;
  const hasValue = Boolean(value.trim());
  const isLabelFloating = hasValue || isFocused;

  return (
    <div
      className={[
        styles.root,
        isLabelFloating ? styles.withFloatingLabel : '',
        disabled ? styles.disabled : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {label ? (
        <div className={styles.label}>{label}</div>
      ) : null}

      <div className={styles.toolbar} aria-label="Форматирование аннотации">
        <ToolbarButton
          label="↶"
          title="Отменить"
          disabled={!canUseToolbar || !editor?.can().undo()}
          onClick={() => editor?.chain().focus().undo().run()}
        />
        <ToolbarButton
          label="↷"
          title="Повторить"
          disabled={!canUseToolbar || !editor?.can().redo()}
          onClick={() => editor?.chain().focus().redo().run()}
        />
        <span className={styles.toolbarDivider} aria-hidden="true" />
        <ToolbarButton
          label="B"
          title="Жирный"
          active={editor?.isActive('bold')}
          disabled={!canUseToolbar}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="I"
          title="Курсив"
          active={editor?.isActive('italic')}
          disabled={!canUseToolbar}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label="U"
          title="Подчёркнутый"
          active={editor?.isActive('underline')}
          disabled={!canUseToolbar}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        />
        <ToolbarButton
          label="S"
          title="Зачёркнутый"
          active={editor?.isActive('strike')}
          disabled={!canUseToolbar}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        />
        <span className={styles.toolbarDivider} aria-hidden="true" />
        <ToolbarButton
          label="x²"
          title="Надстрочный"
          active={editor?.isActive('superscript')}
          disabled={!canUseToolbar}
          onClick={() => editor?.chain().focus().toggleSuperscript().run()}
        />
        <ToolbarButton
          label="x₂"
          title="Подстрочный"
          active={editor?.isActive('subscript')}
          disabled={!canUseToolbar}
          onClick={() => editor?.chain().focus().toggleSubscript().run()}
        />
        <span className={styles.toolbarDivider} aria-hidden="true" />
        <ToolbarButton
          label="•"
          title="Маркированный список"
          active={editor?.isActive('bulletList')}
          disabled={!canUseToolbar}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          label="1."
          title="Нумерованный список"
          active={editor?.isActive('orderedList')}
          disabled={!canUseToolbar}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        />
        <span className={styles.toolbarDivider} aria-hidden="true" />
        <ToolbarButton
          label="Tx"
          title="Очистить форматирование"
          disabled={!canUseToolbar}
          onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}
        />
      </div>

      {!label && !hasValue && !isFocused && placeholder ? (
        <div className={styles.placeholder}>{placeholder}</div>
      ) : null}

      <EditorContent editor={editor} className={styles.editorContent} />
    </div>
  );
}
