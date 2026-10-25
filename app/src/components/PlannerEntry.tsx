import { ArrowRight, BookOpen, SlidersHorizontal } from 'lucide-react'

export type Experience = 'guided' | 'quick'

interface Props {
  onChoose: (experience: Experience) => void
}

export default function PlannerEntry({ onChoose }: Props) {
  return (
    <section className="planner-entry" aria-labelledby="entry-heading">
      <div className="plan-heading-row">
        <p className="plan-step">Start here</p>
        <h1 id="entry-heading" tabIndex={-1}>Your plan, your way.</h1>
        <p className="plan-intro">Choose the way you would like to explore investing.</p>
      </div>
      <div className="entry-choices">
        <button className="entry-choice" type="button" onClick={() => onChoose('guided')}>
          <span className="entry-choice-icon"><BookOpen size={24} strokeWidth={1.7} aria-hidden="true" /></span>
          <span className="entry-choice-copy">
            <span className="entry-choice-title">Guide me step by step</span>
            <span className="entry-choice-description">New to investing or Horizon? We’ll explain each choice as you go.</span>
            <span className="entry-choice-detail">One question at a time</span>
          </span>
          <ArrowRight className="entry-choice-arrow" size={20} aria-hidden="true" />
        </button>
        <button className="entry-choice" type="button" onClick={() => onChoose('quick')}>
          <span className="entry-choice-icon"><SlidersHorizontal size={24} strokeWidth={1.7} aria-hidden="true" /></span>
          <span className="entry-choice-copy">
            <span className="entry-choice-title">I’ll fill it in</span>
            <span className="entry-choice-description">See all the options at once and set up your plan quickly.</span>
            <span className="entry-choice-detail">All fields together</span>
          </span>
          <ArrowRight className="entry-choice-arrow" size={20} aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
