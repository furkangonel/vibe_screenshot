import { useEffect, useState, type ReactNode } from 'react';
import { hasFiles } from './files';
import { useI18n } from './i18n';

export default function FileDrop({
  children,
  onFiles,
  label,
}: {
  children: ReactNode;
  onFiles: (files: File[]) => void;
  label?: string;
}) {
  const [over, setOver] = useState(false);
  useEffect(() => {
    if (!over) return;
    const clear = () => setOver(false);
    window.addEventListener('drop', clear, true);
    window.addEventListener('dragend', clear, true);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('drop', clear, true);
      window.removeEventListener('dragend', clear, true);
      window.removeEventListener('blur', clear);
    };
  }, [over]);
  const { t } = useI18n();
  return (
    <div
      className={`file-drop ${over ? 'is-drag-over' : ''}`}
      aria-label={label}
      onDragOver={(event) => {
        if (hasFiles(event)) {
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = 'copy';
          setOver(true);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setOver(false);
      }}
      onDrop={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        event.stopPropagation();
        setOver(false);
        onFiles(Array.from(event.dataTransfer.files));
      }}
    >
      {children}
      {over && <div className="file-drop-hint">{t('Drop files here')}</div>}
    </div>
  );
}
