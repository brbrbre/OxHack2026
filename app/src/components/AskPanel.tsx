import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ChevronDown, LoaderCircle, MessageCircleQuestionMark, Send } from 'lucide-react'
import { api } from '../api/client'
import type { AskTurn, DecideResponse, PlanResponse } from '../api/types'
import { askContext, suggestedQuestions } from '../lib/askContext'
import { useI18n } from '../i18n/I18nContext'

interface Props {
  result: DecideResponse | null
  plan: PlanResponse | null
}

interface Turn extends AskTurn {
  fuente: 'gemini' | 'local' | 'offline'
}

export default function AskPanel({ result, plan }: Props) {
  const { t } = useI18n()
  const [turns, setTurns] = useState<Turn[]>([])
  const [question, setQuestion] = useState('')
  const [pending, setPending] = useState(false)
  const controller = useRef<AbortController | null>(null)

  // A new answer on screen starts a new conversation.
  useEffect(() => {
    controller.current?.abort()
    setTurns([])
    setPending(false)
    setQuestion('')
    return () => controller.current?.abort()
  }, [result, plan])

  if (!result && !plan) return null

  async function ask(text: string) {
    const pregunta = text.trim()
    if (pregunta.length < 2 || pending) return
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current
    setPending(true)
    setQuestion('')
    try {
      const answer = await api.ask({
        pregunta: pregunta.slice(0, 300),
        simbolo: plan ? undefined : result?.simbolo,
        contexto: askContext(result, plan),
        historial: turns.slice(-4).map(({ pregunta: q, respuesta }) => ({ pregunta: q, respuesta })),
      }, current.signal)
      if (!current.signal.aborted) setTurns((all) => [...all, { pregunta, ...answer }])
    } catch {
      if (!current.signal.aborted) {
        setTurns((all) => [...all, { pregunta, respuesta: 'We could not reach the tutor. Please try again.', fuente: 'offline' }])
      }
    } finally {
      if (!current.signal.aborted) setPending(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void ask(question)
  }

  const asked = new Set(turns.map((turn) => turn.pregunta))
  const suggestions = suggestedQuestions(result, plan).filter((item) => !asked.has(item))
  function questionLabel(item: string) {
    if (result && item === 'What is ' + result.nombre + ', really?') return t('What is {asset}, really?', { asset: result.nombre })
    if (result && item === 'What does ' + result.nombre + ' do?') return t('What does {asset} do?', { asset: result.nombre })
    return t(item)
  }

  return (
    <details className="ask-panel optional-panel" aria-labelledby="ask-heading">
      <summary className="optional-panel-summary">
        <h3 id="ask-heading"><MessageCircleQuestionMark size={18} aria-hidden="true" /> {t('Ask Horizon')}</h3>
        <ChevronDown className="optional-panel-chevron" size={16} aria-hidden="true" />
      </summary>
      <div className="optional-panel-body">
      <p className="ask-intro">{t('Learn what your money would be doing. Ask about this asset or any money idea.')}</p>
      {turns.length > 0 && <ol className="ask-thread" aria-live="polite">
        {turns.map((turn, index) => <li key={index}>
          <p className="ask-question">{questionLabel(turn.pregunta)}</p>
          <p className="ask-answer">{turn.fuente === 'offline' ? t(turn.respuesta) : turn.respuesta}</p>
        </li>)}
      </ol>}
      {pending && <p className="ask-pending" role="status"><LoaderCircle size={16} aria-hidden="true" /> {t('Thinking…')}</p>}
      {suggestions.length > 0 && <div className="question-chips" aria-label={t('Suggested questions')}>
        {suggestions.map((item) => <button type="button" key={item} onClick={() => void ask(item)} disabled={pending}>{questionLabel(item)}</button>)}
      </div>}
      <form className="ask-form" onSubmit={submit}>
        <label htmlFor="ask-input" className="sr-only">{t('Your question')}</label>
        <input id="ask-input" type="text" value={question} maxLength={300} placeholder={t('Ask a money question')}
          onChange={(event) => setQuestion(event.target.value)} />
        <button type="submit" className="ask-send" disabled={pending || question.trim().length < 2}>
          <Send size={16} aria-hidden="true" /> {t('Ask')}
        </button>
      </form>
      <p className="ask-note">{t("Answers by Gemini, for learning. They never change Horizon's numbers and are not financial advice.")}</p>
      </div>
    </details>
  )
}
