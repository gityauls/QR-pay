import { describe, expect, it } from 'vitest';
import { createSpeechListener } from '../src/lib/speech';

type Handler = ((event: unknown) => void) | null;
type RecognitionHandlers = { onresult: Handler; onerror: Handler; onend: Handler };

function fakeRecognition(behavior: (recognition: RecognitionHandlers) => void) {
  const created: FakeRecognition[] = [];
  class FakeRecognition {
    lang = '';
    interimResults = true;
    maxAlternatives = 1;
    continuous = true;
    onresult: Handler = null;
    onerror: Handler = null;
    onend: Handler = null;
    constructor() { created.push(this); }
    start() { behavior(this); }
    abort() {}
  }
  return { Recognition: FakeRecognition, created };
}

function results(...transcripts: string[]) {
  const alternatives = transcripts.map((transcript) => ({ transcript }));
  return { results: [alternatives] };
}

describe('speech listener', () => {
  it('is unavailable when the browser has no speech recognition', () => {
    expect(createSpeechListener({})).toBeNull();
  });

  it('listens once in Korean and returns every alternative', async () => {
    const { Recognition, created } = fakeRecognition((recognition) => {
      recognition.onresult?.(results('만오천원', '만 오천 원'));
      recognition.onend?.(null);
    });
    const listen = createSpeechListener({ webkitSpeechRecognition: Recognition });
    await expect(listen?.()).resolves.toEqual({ ok: true, transcripts: ['만오천원', '만 오천 원'] });
    expect(created[0]).toMatchObject({ lang: 'ko-KR', interimResults: false, continuous: false });
    expect(created[0].maxAlternatives).toBeGreaterThan(1);
  });

  it.each([
    ['not-allowed', 'denied'],
    ['service-not-allowed', 'denied'],
    ['no-speech', 'no-speech'],
    ['network', 'network'],
    ['audio-capture', 'failed'],
  ])('reports the %s error as %s', async (error, reason) => {
    const { Recognition } = fakeRecognition((recognition) => {
      recognition.onerror?.({ error });
      recognition.onend?.(null);
    });
    const listen = createSpeechListener({ SpeechRecognition: Recognition });
    await expect(listen?.()).resolves.toEqual({ ok: false, reason });
  });

  it('treats an end without words as silence', async () => {
    const { Recognition } = fakeRecognition((recognition) => recognition.onend?.(null));
    const listen = createSpeechListener({ SpeechRecognition: Recognition });
    await expect(listen?.()).resolves.toEqual({ ok: false, reason: 'no-speech' });
  });

  it('reports a recognizer that cannot start', async () => {
    const { Recognition } = fakeRecognition(() => { throw new Error('busy'); });
    const listen = createSpeechListener({ SpeechRecognition: Recognition });
    await expect(listen?.()).resolves.toEqual({ ok: false, reason: 'failed' });
  });
});
