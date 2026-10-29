import { useEffect, useState } from 'react';
import { Lightbulb, RotateCcw, Volume2, Square, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { languages, type Language } from '../../../shared/languages';
import type { Turn } from '../../../shared/conversation';
import type { AudioPlayer } from './use-audio-player';

export function LearningPanel({ language, turn, player, recording, onRetry }: {
 language: Language; turn: Turn; player: AudioPlayer; recording: boolean; onRetry: () => void;
}) {
 const [seconds, setSeconds] = useState(0);
 const [replay, setReplay] = useState(0);
 const learning = turn.learning;
 useEffect(() => {
  setSeconds(0);
  const started = Date.now();
  const timer = window.setInterval(() => setSeconds((Date.now() - started) / 1000), 250);
  return () => window.clearInterval(timer);
 }, [turn.id, learning.status, replay]);
 const finished = seconds >= 32;
 return <section aria-label="대화와 힌트" className="space-y-5">
  {learning.status === 'error' && <div role="status" className="rounded-2xl bg-muted p-4 text-sm"><p>{learning.error}</p><Button variant="outline" className="mt-3" onClick={onRetry}><RotateCcw /> 학습 자료 다시 만들기</Button></div>}
  {learning.status === 'pending' && <p role="status" className="text-sm text-muted-foreground">답변 힌트를 준비하고 있어요.</p>}
  {learning.status === 'ready' && <div className="space-y-3">
   {turn.userText && learning.feedback && seconds < 26 && <div className={`float-in rounded-2xl border border-white/5 bg-white/[0.035] px-5 py-4 ${seconds >= 25 ? 'float-out' : ''}`}>
    <p className="mb-2 text-xs font-medium text-muted-foreground">내 표현 피드백</p>
    {learning.feedback.improved && <p lang={languages[language].tag} className="mb-1 leading-relaxed text-foreground">더 자연스럽게: {learning.feedback.improved.text}</p>}
    <p className="text-sm leading-relaxed text-muted-foreground">{learning.feedback.explanation}</p>
   </div>}
   {!finished && <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-violet-300"><Lightbulb className="size-4" /> 이렇게 답해볼까요?</div>}
   {learning.suggestions.map((expression, index) => {
    const start = index * 1.3;
    const end = 26 + index * 3;
    if (seconds < start || seconds >= end) return null;
    const active = player.playingId === expression.id;
    return <article key={expression.id} className={`float-in rounded-2xl border border-violet-300/10 bg-[#1b1b2a] px-5 py-4 ${seconds >= end - 1 ? 'float-out' : ''}`}>
     <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-1.5"><p className="text-xs text-violet-300">{expression.label}</p><p lang={languages[language].tag} className="font-medium leading-relaxed break-words">{expression.text}</p>
       {expression.pronunciation && <p className="text-sm text-violet-200/80">{expression.pronunciation}</p>}
       <p className="text-sm leading-relaxed text-muted-foreground">{expression.translation}</p></div>
      <Button variant="ghost" size="icon" disabled={recording} onClick={() => active ? player.stop() : void player.play(expression.id)} aria-label={`${expression.label} ${active ? '재생 멈추기' : '듣기'}`}>
       {active ? player.loading ? <LoaderCircle className="animate-spin" /> : <Square /> : <Volume2 />}
      </Button>
     </div>
    </article>;
   })}
   {finished && <Button variant="ghost" className="text-muted-foreground" onClick={() => setReplay(value => value + 1)}><RotateCcw /> 힌트 다시 보기</Button>}
  </div>}
 </section>;
}
