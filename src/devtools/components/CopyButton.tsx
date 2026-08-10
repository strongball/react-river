import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';

import { IconCopy } from './Icons';

interface CopyButtonProps {
  value: string;
  label?: string;
}

/** Small copy control used beside long provider names and values. */
export function CopyButton({ value, label = 'Copy' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (resetTimer.current !== undefined) window.clearTimeout(resetTimer.current);
    };
  }, []);

  const handleCopy = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      setCopied(true);
      if (resetTimer.current !== undefined) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      className="rd-copy-btn"
      onClick={handleCopy}
      onKeyDown={(event) => event.stopPropagation()}
      title={`${label} ${value}`}
      aria-label={`${label} ${value}`}
    >
      {copied ? '✓' : <IconCopy />}
    </button>
  );
}
