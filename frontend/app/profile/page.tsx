'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import {
  changePassword,
  deleteAccount,
  fetchFollows,
  fetchProfile,
  followTopic,
  followUser,
  unfollowTopic,
  unfollowUser,
  updateProfile,
} from '@/lib/api'
import { useStore } from '@/lib/store'
import { CATEGORIES, type FollowItem, type UserProfile } from '@/types'
import ThemeSync from '@/components/ThemeSync'
import BottomNav from '@/components/BottomNav'
import Footer from '@/components/Footer'

export default function ProfilePage() {
  const router = useRouter()
  const { user, token, logout } = useStore()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [follows, setFollows] = useState<FollowItem[]>([])
  const [loading, setLoading] = useState(true)
  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [followUserInput, setFollowUserInput] = useState('')

  useEffect(() => {
    if (!user) router.replace('/')
  }, [user, router])

  useEffect(() => {
    if (!token) return
    setLoading(true)
    Promise.all([fetchProfile(token), fetchFollows(token)])
      .then(([profileRes, followsRes]) => {
        setProfile(profileRes)
        setFullName(profileRes.full_name ?? '')
        setBio(profileRes.bio ?? '')
        setFollows(followsRes)
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to load profile.'
        setError(msg)
      })
      .finally(() => setLoading(false))
  }, [token])

  const followedTopics = useMemo(
    () => new Set(follows.filter((f) => f.follow_type === 'topic').map((f) => f.target)),
    [follows]
  )
  const followedUsers = useMemo(
    () => follows.filter((f) => f.follow_type === 'user').map((f) => f.target),
    [follows]
  )

  if (!user) return null

  const saveProfile = async () => {
    if (!token) return
    setSaving(true)
    setError('')
    try {
      const updated = await updateProfile(token, { full_name: fullName, bio })
      setProfile(updated)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile.'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const onChangePassword = async () => {
    if (!token || !currentPassword || !newPassword) return
    setSaving(true)
    setError('')
    try {
      await changePassword(token, {
        current_password: currentPassword,
        new_password: newPassword,
      })
      setCurrentPassword('')
      setNewPassword('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to change password.'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const onDeleteAccount = async () => {
    if (!token) return
    const ok = window.confirm('Delete account permanently? This cannot be undone.')
    if (!ok) return
    setSaving(true)
    setError('')
    try {
      await deleteAccount(token)
      logout()
      router.replace('/')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete account.'
      setError(msg)
      setSaving(false)
    }
  }

  const toggleTopic = async (topic: string) => {
    if (!token) return
    const normalized = topic.toLowerCase()
    const already = followedTopics.has(normalized)
    try {
      if (already) {
        await unfollowTopic(token, normalized)
      } else {
        await followTopic(token, normalized)
      }
      const refreshed = await fetchFollows(token)
      setFollows(refreshed)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update followed topics.'
      setError(msg)
    }
  }

  const addUserFollow = async () => {
    if (!token || !followUserInput.trim()) return
    const target = followUserInput.trim()
    try {
      await followUser(token, target)
      const refreshed = await fetchFollows(token)
      setFollows(refreshed)
      setFollowUserInput('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to follow user.'
      setError(msg)
    }
  }

  const removeUserFollow = async (target: string) => {
    if (!token) return
    try {
      await unfollowUser(token, target)
      const refreshed = await fetchFollows(token)
      setFollows(refreshed)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to unfollow user.'
      setError(msg)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-dark-bg pb-24">
      <ThemeSync />
      <header className="px-5 pt-12 pb-4">
        <h1 className="font-display text-2xl font-semibold text-ink dark:text-white">Profile</h1>
        {profile && (
          <p className="mt-1 text-xs font-sans text-muted dark:text-gray-500">
            {profile.stats.articles_read} reads · {profile.stats.comments} comments
          </p>
        )}
      </header>

      <main className="px-4 space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-border bg-white p-4 dark:border-dark-border dark:bg-dark-surface">
            Loading profile…
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-border bg-white p-4 dark:border-dark-border dark:bg-dark-surface">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted dark:text-gray-500">
                Account
              </p>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name"
                className="mb-2 w-full rounded-lg border border-border px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-bg"
              />
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Bio"
                rows={3}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-bg"
              />
              <button
                onClick={saveProfile}
                disabled={saving}
                className="mt-3 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-ink"
              >
                Save profile
              </button>
            </section>

            <section className="rounded-2xl border border-border bg-white p-4 dark:border-dark-border dark:bg-dark-surface">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted dark:text-gray-500">
                Follow topics
              </p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => {
                  const followed = followedTopics.has(cat.toLowerCase())
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleTopic(cat)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        followed
                          ? 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-ink'
                          : 'border-border bg-white text-ink dark:border-dark-border dark:bg-dark-bg dark:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-white p-4 dark:border-dark-border dark:bg-dark-surface">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted dark:text-gray-500">
                Follow users
              </p>
              <div className="flex gap-2">
                <input
                  value={followUserInput}
                  onChange={(e) => setFollowUserInput(e.target.value)}
                  placeholder="Username"
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-bg"
                />
                <button
                  onClick={addUserFollow}
                  className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white dark:bg-white dark:text-ink"
                >
                  Follow
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {followedUsers.length === 0 ? (
                  <span className="text-xs text-muted dark:text-gray-500">No users followed yet.</span>
                ) : (
                  followedUsers.map((target) => (
                    <button
                      key={target}
                      onClick={() => removeUserFollow(target)}
                      className="rounded-full border border-border px-3 py-1 text-xs font-medium dark:border-dark-border"
                    >
                      @{target} · Unfollow
                    </button>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-white p-4 dark:border-dark-border dark:bg-dark-surface">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted dark:text-gray-500">
                Change password
              </p>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                className="mb-2 w-full rounded-lg border border-border px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-bg"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-bg"
              />
              <button
                onClick={onChangePassword}
                disabled={saving || !currentPassword || !newPassword}
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold dark:border-dark-border"
              >
                <Plus size={14} />
                Update password
              </button>
            </section>

            <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/70 dark:bg-rose-950/30">
              <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">Danger zone</p>
              <button
                onClick={onDeleteAccount}
                disabled={saving}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
              >
                <Trash2 size={14} />
                Delete account
              </button>
            </section>
          </>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300">
            {error}
          </div>
        )}
      </main>

      <Footer />
      <BottomNav />
    </div>
  )
}
