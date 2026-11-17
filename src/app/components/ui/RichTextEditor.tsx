import { WorkspaceTooltip } from "./workspace/WorkspaceTooltip";
import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered } from "lucide-react";

export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none px-3 py-2.5 text-[13px] min-h-[100px] focus:outline-none",
      },
    },
  });

  useEffect(() => {
    if (!editor || value === editor.getHTML()) return;
    editor.commands.setContent(value || "", { emitUpdate: false });
  }, [editor, value]);

  if (!editor) return null;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      <div className="flex items-center gap-1 border-b border-neutral-100 px-2 py-1.5">
        <WorkspaceTooltip content="Bold"><button
          type="button"
          aria-label="Bold completion note text"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded ${editor.isActive("bold") ? "bg-neutral-200" : "hover:bg-neutral-100"}`}
        >
          <Bold size={13} />
        </button></WorkspaceTooltip>
        <WorkspaceTooltip content="Italic"><button
          type="button"
          aria-label="Italicize completion note text"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded ${editor.isActive("italic") ? "bg-neutral-200" : "hover:bg-neutral-100"}`}
        >
          <Italic size={13} />
        </button></WorkspaceTooltip>
        <WorkspaceTooltip content="Bulleted list"><button
          type="button"
          aria-label="Create a bulleted list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded ${editor.isActive("bulletList") ? "bg-neutral-200" : "hover:bg-neutral-100"}`}
        >
          <List size={13} />
        </button></WorkspaceTooltip>
        <WorkspaceTooltip content="Numbered list"><button
          type="button"
          aria-label="Create a numbered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded ${editor.isActive("orderedList") ? "bg-neutral-200" : "hover:bg-neutral-100"}`}
        >
          <ListOrdered size={13} />
        </button></WorkspaceTooltip>
      </div>
      <EditorContent editor={editor} />
      {!value && <div className="px-3 pb-2 text-[11px] text-neutral-300 pointer-events-none -mt-8">{placeholder}</div>}
    </div>
  );
}
