export type ListenResult =
  | { ok: true; transcripts: string[] }
  | { ok: false; reason: 'denied' | 'no-speech' | 'network' | 'failed' };

type RecognitionEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type RecognitionErrorEvent = { error: string };
type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: ((event: unknown) => void) | null;
  start(): void;
};
type RecognitionConstructor = new () => Recognition;
type SpeechWindow = { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };

function errorReason(error: string): Extract<ListenResult, { ok: false }>['reason'] {
  if (error === 'not-allowed' || error === 'service-not-allowed') return 'denied';
  if (error === 'no-speech') return 'no-speech';
  if (error === 'network') return 'network';
  return 'failed';
}

// Returns null where the browser cannot recognize speech, so the page can hide the button.
export function createSpeechListener(windowLike: SpeechWindow): (() => Promise<ListenResult>) | null {
  const Recognizer = (windowLike.SpeechRecognition ?? windowLike.webkitSpeechRecognition) as RecognitionConstructor | undefined;
  if (typeof Recognizer !== 'function') return null;

  return () => new Promise<ListenResult>((resolve) => {
    let settled = false;
    const finish = (result: ListenResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const recognition = new Recognizer();
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 5;
    recognition.onresult = (event) => {
      const alternatives = event.results[0] ?? [];
      const transcripts = Array.from(alternatives, (alternative) => alternative.transcript.trim()).filter(Boolean);
      finish(transcripts.length ? { ok: true, transcripts } : { ok: false, reason: 'no-speech' });
    };
    recognition.onerror = (event) => finish({ ok: false, reason: errorReason(event.error) });
    recognition.onend = () => finish({ ok: false, reason: 'no-speech' });
    try {
      recognition.start();
    } catch {
      finish({ ok: false, reason: 'failed' });
    }
  });
}
