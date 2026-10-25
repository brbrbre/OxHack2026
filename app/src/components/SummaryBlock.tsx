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
  const audioUrl = useRef<string | null>(null)
  const speech = useRef<SpeechSynthesisUtterance | null>(null)
  const request = useRef<AbortController | null>(null)

  function releasePlayback() {
    if (audio.current) {
      audio.current.onended = null
      audio.current.onerror = null
      audio.current.pause()
      audio.current = null
    }
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current)
    audioUrl.current = null
    if (speech.current) {
      speech.current.onend = null
      speech.current.onerror = null
      window.speechSynthesis?.cancel()
      speech.current = null
    }
  }

  useEffect(() => {
    setPlaying(false)
    setVoice(null)
    return () => {
      request.current?.abort()
      request.current = null
      releasePlayback()
    }
  }, [summary])

  if (!summary && !pending) return null

  async function listen() {
    if (!summary || playing) return
    request.current?.abort()
    releasePlayback()
    const controller = new AbortController()
    request.current = controller
    setPlaying(true)
    const blob = await api.listen(summary.texto, controller.signal).catch(() => null)
    if (controller.signal.aborted) return
    const finish = () => {
      if (controller.signal.aborted) return
      releasePlayback()
      setPlaying(false)
    }
    if (blob) {
      setVoice('elevenlabs')
      const url = URL.createObjectURL(blob)
      audioUrl.current = url
      const player = new Audio(url)
      audio.current = player
      player.onended = finish
      player.onerror = finish
      void player.play().catch(finish)
      return
    }
    if ('speechSynthesis' in window) {
      setVoice('browser')
      const line = new SpeechSynthesisUtterance(summary.texto)
      speech.current = line
      line.lang = 'en-GB'
      line.onend = finish
      line.onerror = finish
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
