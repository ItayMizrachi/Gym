import { PageHeader } from '../components/ui'

/** Placeholder: the "progress-profile" session builds this page (stats dashboard, weekly chart, calendar). */
export default function Profile() {
  return (
    <div className="stack">
      <PageHeader title="Progress" sub="Your training at a glance." />
    </div>
  )
}
