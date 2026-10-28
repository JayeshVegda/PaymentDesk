import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { post, formatInr, ApiError } from '../api/client';

export function useVoidTransaction() {
  const queryClient = useQueryClient();

  return async (options: {
    id: number;
    payeeName: string;
    amountPaise: number;
    reason: string;
  }): Promise<boolean> => {
    try {
      await post(`/transactions/${options.id}/void`, { reason: options.reason });
      await queryClient.invalidateQueries();
      toast.success(`Voided ${formatInr(options.amountPaise)} to ${options.payeeName}`, {
        duration: 8000,
        action: {
          label: 'Undo',
          onClick: () => {
            post(`/transactions/${options.id}/unvoid`, {})
              .then(async () => {
                await queryClient.invalidateQueries();
                toast.success(`Restored ${formatInr(options.amountPaise)} to ${options.payeeName}`);
              })
              .catch((error: ApiError) => {
                toast.error(error.message || 'Failed to restore transaction');
              });
          }
        }
      });
      return true;
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to void transaction');
      return false;
    }
  };
}
