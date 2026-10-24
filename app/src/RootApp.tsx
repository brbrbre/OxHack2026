import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import LandingPage from './pages/landing/LandingPage'
import { hasPlanLink } from './lib/planLink'

const Planner = lazy(() => import('./pages/planner/PlannerPage'))
export type Page = 'home' | 'planner'

export function pageFromSearch(search: string): Page {
  const query = new URLSearchParams(search)
  if (query.has('view')) return query.get('view') === 'planner' ? 'planner' : 'home'
  return hasPlanLink(search) ? 'planner' : 'home'
}

function currentPage(): Page {
  return typeof window === 'undefined' ? 'home' : pageFromSearch(window.location.search)
}

export default function RootApp() {
  const [page, setPage] = useState<Page>(currentPage)
  const [hasVisitedPlanner, setHasVisitedPlanner] = useState(() => currentPage() === 'planner')
  const previousPage = useRef(page)

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
    document.title = page === 'home' ? 'Horizon — Understand before you invest' : 'Horizon — Investment planner'
    if (page === 'home' && previousPage.current !== page) {
      document.getElementById('landing-title')?.focus({ preventScroll: true })
    }
    previousPage.current = page
  }, [page])

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
    {page === 'home' && <LandingPage onStart={() => navigate('planner')} />}
    {hasVisitedPlanner && <div hidden={page !== 'planner'}>
      <Suspense fallback={<main className="page-content" style={{ paddingBlock: 64 }}>
        <p role="status">Opening your planner…</p>
      </main>}>
        <Planner active={page === 'planner'} onHome={() => navigate('home')} />
      </Suspense>
    </div>}
  </>
}
