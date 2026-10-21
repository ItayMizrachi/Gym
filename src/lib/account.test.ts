import { describe, expect, it } from 'vitest'
import { idbKeysToWipe, localKeysToWipe } from './account'

const ME = '6f1c2a9e-0000-4000-8000-000000000001'
const OTHER = '6f1c2a9e-0000-4000-8000-000000000002'

describe('idbKeysToWipe', () => {
  it('takes only this user\u2019s cache, outbox and signed links', () => {
    const all = [
      `gymlog:cache:${ME}`,
      `gymlog:outbox:${ME}`,
      `gymlog:signed:${ME}`,
      `gymlog:cache:${OTHER}`,
      `gymlog:outbox:${OTHER}`,
      'gymlog:db:v1',
      'gymlog:img:local/photos/a.jpg',
      'something-else',
      42
    ]
    expect(idbKeysToWipe(all, ME).sort()).toEqual([`gymlog:cache:${ME}`, `gymlog:outbox:${ME}`, `gymlog:signed:${ME}`])
  })

  it('wipes nothing without a user id', () => {
    expect(idbKeysToWipe(['gymlog:cache:', 'gymlog:db:v1'], '')).toEqual([])
  })
})

describe('localKeysToWipe', () => {
  it('removes per-user flags and workout data, keeps device settings and other people\u2019s flags', () => {
    const all = [
      `gymlog:welcome:${ME}`,
      `gymlog:tips:set-row:${ME}`,
      `gymlog:welcome:${OTHER}`,
      'gymlog:rest',
      'gymlog:folds',
      'gymlog:no-library-photo',
      'gymlog:mode',
      'gymlog:sound',
      'gymlog:awake',
      'gymlog:prefs',
      'gymlog:keypad',
      'sb-abc-auth-token'
    ]
    expect(localKeysToWipe(all, ME).sort()).toEqual(
      [
        `gymlog:tips:set-row:${ME}`,
        `gymlog:welcome:${ME}`,
        'gymlog:folds',
        'gymlog:mode',
        'gymlog:no-library-photo',
        'gymlog:rest'
      ].sort()
    )
  })
})
