import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, Volume2 } from 'lucide-react'
import { api } from '../api/client'
import type { SummaryResponse } from '../api/types'

interface Props {
  summary: SummaryResponse | null
  pending: boolean
}

export default function SummaryBlock({ summary, pending }: Props) {
  const [playing, setPlaying] = useState(false)
  const [voice, setVoice] = useState<'elevenlabs' | 'browser' | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)

  useEffect(() => () => {
    audio.current?.pause()
    window.speechSynthesis?.cancel()
  }, [summary])

  if (!summary && !pending) return null

  async function listen() {
    if (!summary || playing) return
    setPlaying(true)
    const blob = await api.listen(summary.texto)
    if (blob) {
      setVoice('elevenlabs')
      const player = new Audio(URL.createObjectURL(blob))
      audio.current = player
      player.onended = () => setPlaying(false)
      player.onerror = () => setPlaying(false)
      void player.play().catch(() => setPlaying(false))
      return
    }
    if ('speechSynthesis' in window) {
      setVoice('browser')
      const line = new SpeechSynthesisUtterance(summary.texto)
      line.lang = 'en-GB'
      line.onend = () => setPlaying(false)
      line.onerror = () => setPlaying(false)
      window.speechSynthesis.speak(line)
      return
    }
    setPlaying(false)
  }

  return (
    <section className="summary-block" aria-labelledby="summary-heading" aria-busy={pending}>
      <h3 id="summary-heading">In short</h3>
      {pending || !summary ? <p className="summary-pending" role="status"><LoaderCircle size={16} aria-hidden="true" /> Writing a short summary…</p> : <>
        <p className="summary-text">{summary.texto}</p>
        <div className="summary-footer">
          <button type="button" className="listen-button" onClick={() => void listen()} disabled={playing}>
            <Volume2 size={16} aria-hidden="true" /> {playing ? 'Playing…' : 'Listen'}
          </button>
          <span className="summary-source">
            {summary.fuente === 'gemini' ? 'Written by Gemini from the numbers above. It does not change them.' : 'Written from the numbers above.'}
            {voice === 'elevenlabs' ? ' Voice: ElevenLabs.' : voice === 'browser' ? ' Voice: your browser.' : ''}
          </span>
        </div>
      </>}
    </section>
  )
}
