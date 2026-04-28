import { describe, it, expect, vi, beforeEach } from 'vitest'

const { toastError, toastSuccess, toastInfo } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  toastInfo: vi.fn()
}))

vi.mock('@/components/toast', () => ({
  useToast: () => ({
    info: toastInfo,
    success: toastSuccess,
    error: toastError
  })
}))

import { useAsyncAction } from '../../src/composables/use-async-action'

describe('useAsyncAction', () => {
  beforeEach(() => {
    toastError.mockClear()
    toastSuccess.mockClear()
    toastInfo.mockClear()
  })

  it('sets data on success and calls onSuccess', async () => {
    const action = useAsyncAction<number>()
    const onSuccess = vi.fn()

    await action.execute(async () => 42, onSuccess)

    expect(action.state.data).toBe(42)
    expect(action.state.error).toBeNull()
    expect(action.state.loading).toBe(false)
    expect(onSuccess).toHaveBeenCalledWith(42)
    expect(toastError).not.toHaveBeenCalled()
  })

  it('captures Error.message and shows an error toast on failure', async () => {
    const action = useAsyncAction()
    await action.execute(async () => { throw new Error('Network down') })

    expect(action.state.error).toBe('Network down')
    expect(action.state.loading).toBe(false)
    expect(toastError).toHaveBeenCalledWith('Network down')
  })

  it('falls back to a generic message when a non-Error is thrown', async () => {
    const action = useAsyncAction()
    await action.execute(async () => { throw 'string-error' })

    expect(action.state.error).toBe('An unexpected error occurred')
    expect(toastError).toHaveBeenCalledWith('An unexpected error occurred')
  })

  it('flips loading to true during execution and back to false after', async () => {
    const action = useAsyncAction<string>()
    let loadingDuringExec = false

    await action.execute(async () => {
      loadingDuringExec = action.state.loading
      return 'ok'
    })

    expect(loadingDuringExec).toBe(true)
    expect(action.state.loading).toBe(false)
  })

  it('clears the previous error when a new execution starts', async () => {
    const action = useAsyncAction()
    await action.execute(async () => { throw new Error('first') })
    expect(action.state.error).toBe('first')

    await action.execute(async () => 'success')
    expect(action.state.error).toBeNull()
  })

  it('does not call onSuccess when the callback throws', async () => {
    const action = useAsyncAction()
    const onSuccess = vi.fn()
    await action.execute(async () => { throw new Error('fail') }, onSuccess)
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
