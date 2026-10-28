import React, { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { formatInrFull } from '../../lib/format-inr';

export interface TransactionReportRow {
  id: number;
  transactionDate: string;
  transactionTime?: string;
  payeeName: string;
  categoryName?: string | null;
  paymentMethodName?: string | null;
  amountPaise: number;
  note?: string | null;
  needsReview?: boolean;
  status?: string;
  source?: string;
}

interface TransactionsReportTableProps {
  transactions: TransactionReportRow[];
  onSelectTransaction: (tx: TransactionReportRow) => void;
}

const columnHelper = createColumnHelper<TransactionReportRow>();

export function TransactionsReportTable({
  transactions,
  onSelectTransaction
}: TransactionsReportTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'transactionDate', desc: true }
  ]);
  const [pageSize, setPageSize] = useState(20);

  const columns = [
    columnHelper.accessor('transactionDate', {
      header: ({ column }) => (
        <button
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="flex items-center gap-1 hover:text-slate-900 cursor-pointer"
        >
          <span>Date</span>
          <ArrowUpDown className="w-3 h-3 text-slate-400" />
        </button>
      ),
      cell: (info) => <span className="font-semibold text-slate-900">{info.getValue()}</span>
    }),
    columnHelper.accessor('payeeName', {
      header: 'Payee',
      cell: (info) => <span className="font-bold text-slate-800">{info.getValue()}</span>
    }),
    columnHelper.accessor('categoryName', {
      header: 'Category',
      cell: (info) => {
        const val = info.getValue();
        return val ? (
          <span className="inline-block px-2 py-0.5 text-[11px] font-semibold text-blue-800 bg-blue-50 border border-blue-200 rounded-md">
            {val}
          </span>
        ) : (
          <span className="inline-block px-2 py-0.5 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-md">
            Uncategorised
          </span>
        );
      }
    }),
    columnHelper.accessor('note', {
      header: 'Note',
      cell: (info) => {
        const note = info.getValue();
        return note ? (
          <span className="text-slate-600 truncate max-w-[200px] block" title={note}>
            {note}
          </span>
        ) : (
          <span className="text-slate-300 italic">—</span>
        );
      }
    }),
    columnHelper.accessor('paymentMethodName', {
      header: 'Method',
      cell: (info) => (
        <span className="text-slate-500 text-xs font-medium">{info.getValue() || 'Cash'}</span>
      )
    }),
    columnHelper.accessor('amountPaise', {
      header: ({ column }) => (
        <div className="text-right">
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="inline-flex items-center gap-1 hover:text-slate-900 ml-auto cursor-pointer"
          >
            <span>Amount</span>
            <ArrowUpDown className="w-3 h-3 text-slate-400" />
          </button>
        </div>
      ),
      cell: (info) => (
        <div className="text-right font-bold text-slate-900 tabular-nums">
          {formatInrFull(info.getValue())}
        </div>
      )
    })
  ];

  const table = useReactTable({
    data: transactions,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize }
    }
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden space-y-3 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Matching Transactions
          </h3>
          <p className="text-xs text-slate-500">
            {transactions.length} payment{transactions.length === 1 ? '' : 's'} found
          </p>
        </div>

        {/* Page size dropdown */}
        <div className="flex items-center gap-2 self-end sm:self-auto text-xs font-medium text-slate-500">
          <span>Show:</span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => {
              const size = Number(e.target.value);
              setPageSize(size);
              table.setPageSize(size);
            }}
            className="px-2 py-1 text-xs border border-slate-300 rounded-md bg-slate-50 focus:bg-white focus:outline-none"
          >
            {[20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} rows
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200 select-none">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 font-bold">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onSelectTransaction(row.original)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-slate-700">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400 italic">
                  No matching transactions found for current report filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between pt-2 text-xs text-slate-500 font-medium">
          <span>
            Page <strong>{table.getState().pagination.pageIndex + 1}</strong> of{' '}
            <strong>{table.getPageCount()}</strong>
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
