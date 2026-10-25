import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import LandingPage from './pages/landing/LandingPage'
import InformationNotice from './components/InformationNotice'
import SunriseIntro, { shouldShowIntro } from './components/SunriseIntro'
import { useI18n } from './i18n/I18nContext'

const Planner = lazy(() => import('./App'))
export type Page = 'home' | 'planner'

export function pageFromSearch(search: string): Page {
  const query = new URLSearchParams(search)
  if (query.has('view')) return query.get('view') === 'planner' ? 'planner' : 'home'
  return query.has('simbolo') ? 'planner' : 'home'
}

function currentPage(): Page {
  return typeof window === 'undefined' ? 'home' : pageFromSearch(window.location.search)
}

export default function RootApp() {
  const { t } = useI18n()
  const [page, setPage] = useState<Page>(currentPage)
  const [hasVisitedPlanner, setHasVisitedPlanner] = useState(() => currentPage() === 'planner')
  const previousPage = useRef(page)
  const [showIntro, setShowIntro] = useState(() =>
    typeof window !== 'undefined' && shouldShowIntro(window.location.search))
  const introShown = useRef(showIntro)
  const finishIntro = useCallback(() => {
    setShowIntro(false)
  }, [])
  useEffect(() => {
    if (!showIntro && introShown.current) {
      introShown.current = false
      if (page === 'home') document.getElementById('landing-title')?.focus({ preventScroll: true })
    }
  }, [showIntro, page])

  useEffect(() => {
    function restorePage() {
      const next = currentPage()
      if (next === 'planner') setHasVisitedPlanner(true)
      setPage(next)
    }
    window.addEventListener('popstate', restorePage)
    return () => window.removeEventListener('popstate', restorePage)
  }, [])

  useEffect(() => {
    document.title = t(page === 'home' ? 'Horizon — Understand before you invest' : 'Horizon — Investment planner')
    if (page === 'home' && previousPage.current !== page) {
      document.getElementById('landing-title')?.focus({ preventScroll: true })
    }
    previousPage.current = page
  }, [page, t])

  function navigate(next: Page) {
    if (next === page) return
    const url = new URL(window.location.href)
    if (next === 'planner') url.searchParams.set('view', 'planner')
    else {
      url.searchParams.delete('view')
      for (const key of ['simbolo', 'monto', 'plazo', 'perfil']) url.searchParams.delete(key)
    }
    url.hash = ''
    window.history.pushState({ page: next }, '', url)
    window.scrollTo({ top: 0, behavior: 'instant' })
    if (next === 'planner') setHasVisitedPlanner(true)
    setPage(next)
  }

  return <>
    {showIntro && <SunriseIntro onComplete={finishIntro} />}
    <div inert={showIntro}>
    {page === 'home' && <LandingPage onStart={() => navigate('planner')} />}
    {hasVisitedPlanner && <div hidden={page !== 'planner'}>
      <Suspense fallback={<main className="page-content" style={{ paddingBlock: 64 }}>
        <p role="status">{t('Opening your planner…')}</p>
      </main>}>
        <Planner active={page === 'planner' && !showIntro} onHome={() => navigate('home')} />
      </Suspense>
    </div>}
    </div>
    <InformationNotice />
  </>
}
