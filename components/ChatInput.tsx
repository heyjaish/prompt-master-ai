"use client";
import { useRef, useState, useEffect, useCallback, KeyboardEvent, ChangeEvent } from "react";
import { Send, Paperclip, X, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export interface UploadedImage { preview: string; data: string; mimeType: string; name: string; }

interface Props {
  onSend: (idea: string, images: UploadedImage[]) => void;
  isLoading: boolean;
  initialValue?: string;
  onClearInitial?: () => void;
  appendText?: string;
  onClearAppend?: () => void;
  disableImage?: boolean;
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export default function ChatInput({ onSend, isLoading, initialValue = "", onClearInitial, appendText, onClearAppend, disableImage }: Props) {
  const [value, setValue] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [drag, setDrag] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialValue) { setValue(initialValue); onClearInitial?.(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue]);

  useEffect(() => {
    if (appendText) {
      setValue(p => p ? `${p.trimEnd()}, ${appendText}` : appendText);
      onClearAppend?.();
      ref.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appendText]);

  const resize = () => {
    const el = ref.current; if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const processFile = (file: File): Promise<UploadedImage> =>
    new Promise((res, rej) => {
      if (!ACCEPTED.includes(file.type)) { rej(new Error("Unsupported type")); return; }
      const r = new FileReader();
      r.onload = e => { const src = e.target!.result as string; res({ preview: src, data: src.split(",")[1], mimeType: file.type, name: file.name }); };
      r.onerror = rej;
      r.readAsDataURL(file);
    });

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).slice(0, 4 - images.length);
    if (!arr.length) { toast.error("Max 4 images"); return; }
    try {
      const results = await Promise.all(arr.map(processFile));
      setImages(p => [...p, ...results]);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); }
  }, [images.length]);

  const send = () => {
    const t = value.trim();
    if (!t && images.length === 0) return;
    onSend(t, images);
    setValue(""); setImages([]);
    if (ref.current) ref.current.style.height = "auto";
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !isLoading) { e.preventDefault(); send(); }
  };

  const canSend = !isLoading && (value.trim().length > 0 || images.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {images.length > 0 && (
        <div className="anim-in" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {images.map((img, i) => (
            <div key={i} className="img-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.preview} alt={img.name} />
              <button className="img-remove" onClick={() => setImages(p => p.filter((_, j) => j !== i))}>
                <X size={14} color="white" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        className={`input-wrap${drag ? " drag-over" : ""}`}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
      >
        <textarea
          ref={ref}
          className="chat-textarea"
          value={value}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => { setValue(e.target.value); resize(); }}
          onKeyDown={onKey}
          placeholder="Describe your idea — I'll engineer the perfect prompt…"
          disabled={isLoading}
          rows={1}
        />
        <div className="input-toolbar">
          {!disableImage && (
            <>
              <button className="icon-btn" onClick={() => fileRef.current?.click()} disabled={images.length >= 4} title="Attach image">
                <Paperclip size={15} />
              </button>
              <input ref={fileRef} type="file" accept={ACCEPTED.join(",")} multiple style={{ display: "none" }}
                onChange={e => { if (e.target.files) { addFiles(e.target.files); e.target.value = ""; } }} />
            </>
          )}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
            <span style={{ fontSize: 11.5, color: "var(--tx-3)" }}>
              <kbd>Ctrl</kbd>+<kbd>↵</kbd>
            </span>
            <button className="send-btn" onClick={send} disabled={!canSend}>
              {isLoading ? <Loader2 size={15} className="spin" /> : <Send size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
