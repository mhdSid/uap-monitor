import type { AsyncState } from '@/types'
import { useToast } from '@/components/toast'

export function useAsyncAction<T>() {
  const toast = useToast()
  const state: AsyncState<T> = {
    data: null,
    loading: false,
    error: null
  }

  async function execute(
    callback: () => Promise<T>,
    onSuccess?: (data: T) => void
  ): Promise<void> {
    state.loading = true
    state.error = null

    try {
      const result = await callback()
      state.data = result
      onSuccess?.(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred'
      state.error = message
      toast.error(message)
    } finally {
      state.loading = false
    }
  }

  return { state, execute }
}
