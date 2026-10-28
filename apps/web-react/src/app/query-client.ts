import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: false,
      // This is a single-user local ledger. Keep the browser quiet while idle;
      // saving a payment and the global refresh button still invalidate data.
      staleTime: 60000
    }
  }
});
