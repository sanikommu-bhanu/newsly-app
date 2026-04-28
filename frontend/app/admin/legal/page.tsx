'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  createTakedown,
  deleteAdminEditorPick,
  fetchAdminEditorPicks,
  fetchPublisherControls,
  fetchTakedowns,
  resolveTakedown,
  upsertAdminEditorPick,
  upsertPublisherControl,
} from '@/lib/api'
import { useStore } from '@/lib/store'
import type { EditorPick, PublisherControl, TakedownRequest } from '@/types'

export default function AdminLegalPage() {
  const { token } = useStore()
  const [controls, setControls] = useState<PublisherControl[]>([])
  const [takedowns, setTakedowns] = useState<TakedownRequest[]>([])
  const [picks, setPicks] = useState<EditorPick[]>([])
  const [source, setSource] = useState('')
  const [maxPerFeed, setMaxPerFeed] = useState('0')
  const [blocked, setBlocked] = useState(false)
  const [pickForm, setPickForm] = useState({
    article_id: '',
    title: '',
    source: '',
    note: '',
    rank: '1',
  })
  const [td, setTd] = useState({
    source: '',
    article_url: '',
    requester_email: '',
    reason: '',
  })

  const reload = useCallback(() => {
    if (!token) return
    fetchPublisherControls(token).then(setControls).catch(() => {})
    fetchTakedowns(token).then(setTakedowns).catch(() => {})
    fetchAdminEditorPicks(token).then(setPicks).catch(() => {})
  }, [token])

  useEffect(() => {
    reload()
  }, [reload])

  return (
    <main className="min-h-screen bg-[#FAFAFA] px-5 py-10 dark:bg-dark-bg">
      <div className="mx-auto max-w-3xl space-y-5">
        <section className="rounded-2xl border border-border bg-white p-5 dark:border-dark-border dark:bg-dark-surface">
          <h1 className="font-display text-xl font-semibold text-ink dark:text-white">
            Legal & Publisher Admin
          </h1>
          <p className="mt-1 text-xs font-sans text-muted dark:text-gray-500">
            Manage source controls and takedown workflow.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-white p-5 dark:border-dark-border dark:bg-dark-surface">
          <h2 className="font-sans text-sm font-semibold text-ink dark:text-white">Publisher controls</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <input
              className="rounded-lg border border-border px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-bg"
              placeholder="Source name"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
            <input
              className="rounded-lg border border-border px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-bg"
              placeholder="Max/feed"
              value={maxPerFeed}
              onChange={(e) => setMaxPerFeed(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm font-sans">
              <input type="checkbox" checked={blocked} onChange={(e) => setBlocked(e.target.checked)} />
              Blocked
            </label>
            <button
              className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white dark:bg-white dark:text-ink"
              onClick={async () => {
                if (!token || !source.trim()) return
                await upsertPublisherControl(token, {
                  source: source.trim(),
                  is_blocked: blocked,
                  max_per_feed: Number(maxPerFeed || 0),
                  policy_status: blocked ? 'blocked' : 'active',
                })
                setSource('')
                setMaxPerFeed('0')
                setBlocked(false)
                reload()
              }}
            >
              Save
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {controls.map((c) => (
              <div key={c.source} className="rounded-lg border border-border px-3 py-2 text-sm dark:border-dark-border">
                {c.source} · {c.is_blocked ? 'Blocked' : 'Active'} · limit {c.max_per_feed || '∞'}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-white p-5 dark:border-dark-border dark:bg-dark-surface">
          <h2 className="font-sans text-sm font-semibold text-ink dark:text-white">Editor picks</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              className="rounded-lg border border-border px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-bg"
              placeholder="Article ID"
              value={pickForm.article_id}
              onChange={(e) => setPickForm((s) => ({ ...s, article_id: e.target.value }))}
            />
            <input
              className="rounded-lg border border-border px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-bg"
              placeholder="Source"
              value={pickForm.source}
              onChange={(e) => setPickForm((s) => ({ ...s, source: e.target.value }))}
            />
            <input
              className="rounded-lg border border-border px-3 py-2 text-sm sm:col-span-2 dark:border-dark-border dark:bg-dark-bg"
              placeholder="Title"
              value={pickForm.title}
              onChange={(e) => setPickForm((s) => ({ ...s, title: e.target.value }))}
            />
            <input
              className="rounded-lg border border-border px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-bg"
              placeholder="Rank"
              value={pickForm.rank}
              onChange={(e) => setPickForm((s) => ({ ...s, rank: e.target.value }))}
            />
            <input
              className="rounded-lg border border-border px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-bg"
              placeholder="Note"
              value={pickForm.note}
              onChange={(e) => setPickForm((s) => ({ ...s, note: e.target.value }))}
            />
            <button
              className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white sm:col-span-2 dark:bg-white dark:text-ink"
              onClick={async () => {
                if (!token || !pickForm.article_id.trim() || !pickForm.title.trim() || !pickForm.source.trim()) return
                await upsertAdminEditorPick(token, {
                  article_id: pickForm.article_id.trim(),
                  title: pickForm.title.trim(),
                  source: pickForm.source.trim(),
                  note: pickForm.note.trim() || undefined,
                  rank: Number(pickForm.rank || '1'),
                })
                setPickForm({ article_id: '', title: '', source: '', note: '', rank: '1' })
                reload()
              }}
            >
              Save editor pick
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {picks.map((pick) => (
              <div key={pick.id} className="rounded-lg border border-border px-3 py-2 text-sm dark:border-dark-border">
                <p className="font-medium">{pick.title}</p>
                <p className="text-xs text-muted dark:text-gray-500">
                  {pick.source} · rank {pick.rank}
                </p>
                {pick.note ? <p className="mt-1 text-xs">{pick.note}</p> : null}
                {token ? (
                  <button
                    className="mt-2 rounded-md border border-border px-2 py-1 text-xs dark:border-dark-border"
                    onClick={async () => {
                      await deleteAdminEditorPick(token, pick.id)
                      reload()
                    }}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-white p-5 dark:border-dark-border dark:bg-dark-surface">
          <h2 className="font-sans text-sm font-semibold text-ink dark:text-white">Create takedown request</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              className="rounded-lg border border-border px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-bg"
              placeholder="Source"
              value={td.source}
              onChange={(e) => setTd((s) => ({ ...s, source: e.target.value }))}
            />
            <input
              className="rounded-lg border border-border px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-bg"
              placeholder="Requester email"
              value={td.requester_email}
              onChange={(e) => setTd((s) => ({ ...s, requester_email: e.target.value }))}
            />
            <input
              className="rounded-lg border border-border px-3 py-2 text-sm sm:col-span-2 dark:border-dark-border dark:bg-dark-bg"
              placeholder="Article URL"
              value={td.article_url}
              onChange={(e) => setTd((s) => ({ ...s, article_url: e.target.value }))}
            />
            <textarea
              className="rounded-lg border border-border px-3 py-2 text-sm sm:col-span-2 dark:border-dark-border dark:bg-dark-bg"
              placeholder="Reason"
              value={td.reason}
              onChange={(e) => setTd((s) => ({ ...s, reason: e.target.value }))}
            />
            <button
              className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white sm:col-span-2 dark:bg-white dark:text-ink"
              onClick={async () => {
                await createTakedown(td)
                setTd({ source: '', article_url: '', requester_email: '', reason: '' })
                reload()
              }}
            >
              Submit request
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-white p-5 dark:border-dark-border dark:bg-dark-surface">
          <h2 className="font-sans text-sm font-semibold text-ink dark:text-white">Takedown queue</h2>
          <div className="mt-3 space-y-2">
            {takedowns.map((row) => (
              <div key={row.id} className="rounded-lg border border-border px-3 py-2 text-sm dark:border-dark-border">
                <p className="font-medium">{row.source}</p>
                <p className="truncate text-xs text-muted dark:text-gray-500">{row.article_url}</p>
                <p className="mt-1 text-xs">{row.reason}</p>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span>Status: {row.status}</span>
                  {row.status !== 'resolved' && token && (
                    <button
                      className="rounded-md border border-border px-2 py-1 dark:border-dark-border"
                      onClick={async () => {
                        await resolveTakedown(token, row.id)
                        reload()
                      }}
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
