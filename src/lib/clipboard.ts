type ClipboardWriter = {
  writeText(text: string): Promise<void>;
};

type DocumentWithCopy = Document & {
  execCommand?: (command: string) => boolean;
};

export async function copyText(
  text: string,
  clipboard: ClipboardWriter | undefined = navigator.clipboard,
  documentRef: Document = document,
): Promise<boolean> {
  try {
    if (clipboard) {
      await clipboard.writeText(text);
      return true;
    }
  } catch {
    // Continue to the browser-compatible textarea fallback.
  }

  const textarea = documentRef.createElement('textarea');
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  documentRef.body.append(textarea);
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  try {
    const execCommand = (documentRef as DocumentWithCopy).execCommand;
    return typeof execCommand === 'function' && execCommand.call(documentRef, 'copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}
