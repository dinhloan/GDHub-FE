import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';

type SpeechRecognitionCtor = new () => SpeechRecognition;

type WindowWithSpeech = Window & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

export function VoiceNoteButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognition = (window as WindowWithSpeech).SpeechRecognition ?? (window as WindowWithSpeech).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }
    setSupported(true);

    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(' ');
      onTranscript(transcript);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
  }, [onTranscript]);

  const toggle = () => {
    if (!recognitionRef.current) {
      return;
    }

    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    recognitionRef.current.start();
    setListening(true);
  };

  return (
    <button
      type="button"
      className={`grid h-10 w-10 place-items-center rounded border ${
        listening ? 'border-alert bg-alert text-paper' : 'border-ink/10 bg-paper text-ink/70 hover:border-moss'
      }`}
      disabled={!supported}
      onClick={toggle}
      title={supported ? 'Voice note' : 'Voice note is not supported in this browser'}
    >
      {listening ? <MicOff size={18} /> : <Mic size={18} />}
    </button>
  );
}
