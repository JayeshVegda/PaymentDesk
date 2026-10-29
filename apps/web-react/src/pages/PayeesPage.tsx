import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  post,
  patch,
  del,
  formatInr,
  MasterData,
  Payee,
  Category,
  PaymentMethod
} from '../api/client';
import { Star, Plus, Edit, Search, Inbox, Trash2, ChevronLeft, ChevronRight, RotateCcw, GitMerge } from 'lucide-react';
import { toast } from 'sonner';
import { PayeeAvatar } from '../components/common/PayeeAvatar';
import { PayeeDrawer } from '../components/common/PayeeDrawer';
import { SegmentedTabs } from '../components/common/SegmentedTabs';
import { ConfirmModal } from '../components/common/ConfirmModal';
import MergePayeeModal from '../components/payees/MergePayeeModal';

export default function PayeesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'payees' | 'categories' | 'methods'>('payees');
  const [payeeFilter, setPayeeFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [search, setSearch] = useState('');
  const [selectedPayee, setSelectedPayee] = useState<Payee | null>(null);
  const [payeePage, setPayeePage] = useState(1);
  const [payeeSort, setPayeeSort] = useState<'spent' | 'name' | 'recent' | 'payments'>('spent');
  const payeePageSize = 12;

  // Payee Edit Modal state
  const [payeeModalOpen, setPayeeModalOpen] = useState(false);
  const [editingPayee, setEditingPayee] = useState<Payee | null>(null);
  const [mergingPayee, setMergingPayee] = useState<Payee | null>(null);
  const [payeeName, setPayeeName] = useState('');
  const [payeeType, setPayeeType] = useState<'person' | 'company'>('person');
  const [aliases, setAliases] = useState('');
  const [notes, setNotes] = useState('');
  const [favourite, setFavourite] = useState(false);
  const [payeeDefaultCategoryId, setPayeeDefaultCategoryId] = useState('');
  const [payeeDefaultMethodId, setPayeeDefaultMethodId] = useState('');
  const [savingPayee, setSavingPayee] = useState(false);

  // Category Edit Modal state
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categorySortOrder, setCategorySortOrder] = useState(0);
  const [categoryAliases, setCategoryAliases] = useState('');
  const [categoryNote, setCategoryNote] = useState('');
  const [categoryActive, setCategoryActive] = useState(true);
  const [savingCategory, setSavingCategory] = useState(false);

  // Payment Method Edit Modal state
  const [methodModalOpen, setMethodModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [methodDisplayName, setMethodDisplayName] = useState('');
  const [methodCode, setMethodCode] = useState('');
  const [methodActive, setMethodActive] = useState(true);
  const [savingMethod, setSavingMethod] = useState(false);

  // Dynamic ConfirmModal State
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    type: 'danger' | 'warning' | 'info' | 'success';
    confirmText: string;
    previewData?: Record<string, React.ReactNode>;
    phraseToConfirm?: string;
    onConfirm: (typedPhrase?: string) => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    description: '',
    type: 'info',
    confirmText: '',
    onConfirm: () => {}
  });

  // Queries
  const { data: master, isError: masterError, refetch: refetchMaster } = useQuery<MasterData>({
    queryKey: ['master-data-all'],
    queryFn: () => api<MasterData>('/master-data?includeInactive=true')
  });

  const payees = master?.payees || [];
  const categories = master?.categories || [];
  const methods = master?.paymentMethods || [];

  // Sort payees by Total Spent descending by default (Section 4.3 Redesign Spec)
  const sortedPayees = useMemo(() => {
    let list = [...payees];
    if (payeeFilter === 'active') {
      list = list.filter((p) => p.active !== false);
    } else if (payeeFilter === 'archived') {
      list = list.filter((p) => p.active === false);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.aliases?.some((a) => a.toLowerCase().includes(q)));
    }
    return list.sort((a, b) => {
      if (payeeSort === 'name') return a.name.localeCompare(b.name, 'en-IN');
      if (payeeSort === 'payments') return b.paymentCount - a.paymentCount;
      if (payeeSort === 'recent') return b.updatedAt.localeCompare(a.updatedAt);
      return b.totalPaidPaise - a.totalPaidPaise;
    });
  }, [payees, search, payeeSort, payeeFilter]);

  const payeePageCount = Math.max(1, Math.ceil(sortedPayees.length / payeePageSize));
  const visiblePayees = useMemo(
    () => sortedPayees.slice((payeePage - 1) * payeePageSize, payeePage * payeePageSize),
    [sortedPayees, payeePage]
  );

  useEffect(() => setPayeePage(1), [search, payeeSort]);
  useEffect(() => {
    if (payeePage > payeePageCount) setPayeePage(payeePageCount);
  }, [payeePage, payeePageCount]);

  const filteredCategories = useMemo(() => {
    let list = [...categories];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.note.toLowerCase().includes(q) ||
        c.aliases.some((alias) => alias.toLowerCase().includes(q))
      );
    }
    return list.sort((a, b) => a.sortOrder - b.sortOrder);
  }, [categories, search]);

  const filteredMethods = useMemo(() => {
    let list = [...methods];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.displayName.toLowerCase().includes(q) || m.code.toLowerCase().includes(q));
    }
    return list;
  }, [methods, search]);

  const toggleFavorite = async (e: React.MouseEvent, payee: Payee) => {
    e.stopPropagation();
    try {
      await patch(`/payees/${payee.id}`, { favourite: !payee.favourite });
      await refetchMaster();
      toast.success(`${payee.name} ${!payee.favourite ? 'added to' : 'removed from'} favourites`);
    } catch {
      toast.error('Failed to update favourite status');
    }
  };

  const handleSavePayee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payeeName.trim() || savingPayee) return;
    const payload = {
      name: payeeName.trim(),
      type: payeeType,
      aliases: aliases.split(',').map((s) => s.trim()).filter(Boolean),
      notes: notes.trim() || null,
      favourite,
      defaultCategoryId: payeeDefaultCategoryId ? Number(payeeDefaultCategoryId) : null,
      defaultPaymentMethodId: payeeDefaultMethodId ? Number(payeeDefaultMethodId) : null
    };

    setConfirmModalConfig({
      isOpen: true,
      title: editingPayee ? 'Save Payee Changes?' : 'Create New Payee?',
      description: editingPayee ? 'Review details before saving changes.' : 'Confirm registering this new payee.',
      type: 'info',
      confirmText: editingPayee ? 'Save Payee' : 'Create Payee',
      previewData: {
        'Name': payload.name,
        'Aliases': payload.aliases.join(', ') || 'None',
        'Notes': payload.notes || 'None',
        'Favorite': payload.favourite ? 'Yes' : 'No'
      },
      onConfirm: async () => {
        setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
        setSavingPayee(true);
        try {
          if (editingPayee) {
            await patch(`/payees/${editingPayee.id}`, payload);
            toast.success(`Updated payee ${editingPayee.name}`);
          } else {
            await post('/payees', payload);
            toast.success(`Created payee ${payeeName}`);
          }
          await refetchMaster();
          setPayeeModalOpen(false);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Failed to save payee');
        } finally {
          setSavingPayee(false);
        }
      }
    });
  };

  const handleRestorePayee = async (p: Payee) => {
    try {
      await post(`/payees/${p.id}/restore`, {});
      toast.success(`Restored payee "${p.name}" to active list`);
      await refetchMaster();
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to restore payee');
    }
  };

  const handleArchivePayee = async (p: Payee) => {
    try {
      await patch(`/payees/${p.id}`, { active: false });
      toast.success(`Archived payee "${p.name}"`);
      if (selectedPayee?.id === p.id) setSelectedPayee(null);
      setPayeeModalOpen(false);
      await refetchMaster();
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to archive payee');
    }
  };

  const handleDeletePayee = (p: Payee) => {
    setConfirmModalConfig({
      isOpen: true,
      title: p.paymentCount > 0 ? `Archive Payee "${p.name}"?` : `Delete Payee "${p.name}"?`,
      description: p.paymentCount > 0
        ? `Payee "${p.name}" has ${p.paymentCount} transaction(s), so it will be archived and its history retained.`
        : `Payee "${p.name}" has no transactions and will be deleted.`,
      type: 'danger',
      confirmText: p.paymentCount > 0 ? 'Archive Payee' : 'Delete Payee',
      previewData: {
        'Payee Name': p.name,
        'Transactions': p.paymentCount.toString(),
        'Action': p.paymentCount > 0 ? 'Archive and retain history' : 'Delete unused payee'
      },
      onConfirm: async () => {
        setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
        try {
          const result = await del<{ status: 'deleted' | 'archived' }>(`/payees/${p.id}`);
          toast.success(result.status === 'archived' ? `Archived payee "${p.name}"` : `Deleted payee "${p.name}"`);
          if (selectedPayee?.id === p.id) setSelectedPayee(null);
          setPayeeModalOpen(false);
          await refetchMaster();
          await queryClient.invalidateQueries();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Failed to delete payee');
        }
      }
    });
  };

  const handleForceDeletePayee = (p: Payee) => {
    const expectedPhrase = `DELETE ${p.name}`;
    setConfirmModalConfig({
      isOpen: true,
      title: `Permanently Delete "${p.name}"?`,
      description: `This erases ${p.paymentCount} transaction(s), their audit history, and the payee — permanently and irreversibly. A safety backup is taken first and a destruction record is kept in the database.`,
      type: 'danger',
      confirmText: 'Delete everything',
      phraseToConfirm: expectedPhrase,
      previewData: {
        'Payee Name': p.name,
        'Transactions destroyed': p.paymentCount.toString(),
        'Safety backup': 'Taken automatically before deletion'
      },
      onConfirm: async () => {
        setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
        try {
          const result = await del<{ cleanedTransactions: number; backupFile: string | null }>(`/payees/${p.id}?force=true`, { confirm: expectedPhrase });
          toast.success(`Permanently deleted "${p.name}" (${result.cleanedTransactions} transactions). Safety backup: ${result.backupFile ?? 'saved'}`, { duration: 10000 });
          if (selectedPayee?.id === p.id) setSelectedPayee(null);
          setPayeeModalOpen(false);
          await refetchMaster();
          await queryClient.invalidateQueries();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Failed to force-delete payee');
        }
      }
    });
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim() || savingCategory) return;
    const payload = {
      name: categoryName.trim(),
      sortOrder: Number(categorySortOrder),
      aliases: categoryAliases.split(',').map((value) => value.trim()).filter(Boolean),
      note: categoryNote.trim(),
      active: categoryActive
    };

    setConfirmModalConfig({
      isOpen: true,
      title: editingCategory ? 'Save Category Changes?' : 'Create New Category?',
      description: editingCategory ? 'Review details before updating category.' : 'Confirm adding this new category.',
      type: 'info',
      confirmText: editingCategory ? 'Save Category' : 'Create Category',
      previewData: {
        'Category Name': payload.name,
        'Sort Order': payload.sortOrder.toString()
      },
      onConfirm: async () => {
        setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
        setSavingCategory(true);
        try {
          if (editingCategory) {
            await patch(`/categories/${editingCategory.id}`, payload);
            toast.success(`Updated category ${categoryName}`);
          } else {
            await post('/categories', payload);
            toast.success(`Created category ${categoryName}`);
          }
          await refetchMaster();
          setCategoryModalOpen(false);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Failed to save category');
        } finally {
          setSavingCategory(false);
        }
      }
    });
  };

  const handleDeleteCategory = (cat: Category) => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'Delete Category?',
      description: `Deleting this category is permanent. Are you sure you want to delete category "${cat.name}"?`,
      type: 'danger',
      confirmText: 'Delete Category',
      previewData: {
        'Category Name': cat.name
      },
      onConfirm: async () => {
        setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
        try {
          const result = await del<{ status: 'deleted' | 'archived' }>(`/categories/${cat.id}`);
          toast.success(result.status === 'archived' ? `Archived category "${cat.name}"` : `Deleted category "${cat.name}"`);
          await refetchMaster();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Failed to delete category');
        }
      }
    });
  };

  const handleSaveMethod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!methodDisplayName.trim() || !methodCode.trim() || savingMethod) return;
    const payload = {
      displayName: methodDisplayName.trim(),
      code: methodCode.trim().toLowerCase(),
      active: methodActive
    };

    setConfirmModalConfig({
      isOpen: true,
      title: editingMethod ? 'Save Payment Method Changes?' : 'Create Payment Method?',
      description: editingMethod ? 'Review details before updating payment method.' : 'Confirm registering this payment method.',
      type: 'info',
      confirmText: editingMethod ? 'Save Method' : 'Create Method',
      previewData: {
        'Display Name': payload.displayName,
        'Method Code': payload.code,
        'Status': payload.active ? 'Active' : 'Inactive'
      },
      onConfirm: async () => {
        setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
        setSavingMethod(true);
        try {
          if (editingMethod) {
            await patch(`/payment-methods/${editingMethod.id}`, {
              code: payload.code,
              displayName: payload.displayName,
              active: payload.active
            });
            toast.success(`Updated payment method ${methodDisplayName}`);
          } else {
            await post('/payment-methods', payload);
            toast.success(`Created payment method ${methodDisplayName}`);
          }
          await refetchMaster();
          setMethodModalOpen(false);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Failed to save payment method');
        } finally {
          setSavingMethod(false);
        }
      }
    });
  };

  const handleDeleteMethod = (method: PaymentMethod) => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'Delete Payment Method?',
      description: `Deleting this payment method is permanent. Are you sure you want to delete "${method.displayName}"?`,
      type: 'danger',
      confirmText: 'Delete Method',
      previewData: {
        'Display Name': method.displayName,
        'Code': method.code
      },
      onConfirm: async () => {
        setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
        try {
          const result = await del<{ status: 'deleted' | 'archived' }>(`/payment-methods/${method.id}`);
          toast.success(result.status === 'archived' ? `Archived payment method "${method.displayName}"` : `Deleted payment method "${method.displayName}"`);
          await refetchMaster();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Failed to delete payment method');
        }
      }
    });
  };

  const openAddModal = () => {
    setEditingPayee(null);
    setPayeeName('');
    setPayeeType('person');
    setAliases('');
    setNotes('');
    setFavourite(false);
    setPayeeDefaultCategoryId('');
    setPayeeDefaultMethodId('');
    setPayeeModalOpen(true);
  };

  const openEditModal = (e: React.MouseEvent, p: Payee) => {
    e.stopPropagation();
    setEditingPayee(p);
    setPayeeName(p.name);
    setPayeeType(p.type);
    setAliases(p.aliases?.join(', ') || '');
    setNotes(p.notes || '');
    setFavourite(p.favourite);
    setPayeeDefaultCategoryId(p.defaultCategoryId ? String(p.defaultCategoryId) : '');
    setPayeeDefaultMethodId(p.defaultPaymentMethodId ? String(p.defaultPaymentMethodId) : '');
    setPayeeModalOpen(true);
  };

  const tabs = [
    { id: 'payees', label: 'Payees' },
    { id: 'categories', label: 'Categories' },
    { id: 'methods', label: 'Payment Methods' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Master Registers</h1>
      {masterError && (
        <div className="flex items-center gap-3 rounded-lg bg-red-50 p-4 text-sm text-red-800 border border-red-200">
          <span className="font-semibold">Connection Error:</span>
          <span>Unable to connect to the backend server. Please verify the server is running locally on port 4782.</span>
          <button onClick={() => refetchMaster().catch(() => null)} className="ml-auto underline font-semibold hover:text-red-900">Retry</button>
        </div>
      )}
      {/* Unified Register Control Bar */}
      <div className="ledger-card p-3 bg-white border border-[#DDE3EC] rounded-2xl shadow-xs flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Left: Tab Switch (Segmented Control) */}
        <div className="shrink-0">
          <SegmentedTabs
            options={tabs}
            activeId={activeTab}
            onChange={(id) => {
              setActiveTab(id as typeof activeTab);
              setSearch(''); // Clear search on tab switch
            }}
          />
        </div>

        {/* Middle: Search Input */}
        <div className="relative flex-1 w-full max-w-md lg:mx-4">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#667085]" />
          <input
            type="text"
            name="payee-search"
            aria-label="Search"
            autoComplete="off"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              activeTab === 'payees'
                ? "Search payees by name or alias…"
                : activeTab === 'categories'
                ? "Search categories…"
                : "Search payment methods…"
            }
            className="form-input form-input-with-icon h-10 text-xs"
          />
        </div>

        {/* Right: View Toggle (Grid / Table) & Add CTA Button */}
        <div className="flex items-center gap-3 shrink-0 w-full lg:w-auto justify-end">
          {activeTab === 'payees' && (
            <div className="flex items-center gap-2">
              <select
                value={payeeFilter}
                onChange={(event) => setPayeeFilter(event.target.value as typeof payeeFilter)}
                className="form-input h-9 w-32 text-xs font-semibold"
                aria-label="Filter payees status"
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
                <option value="all">All Payees</option>
              </select>
              <select
                value={payeeSort}
                onChange={(event) => setPayeeSort(event.target.value as typeof payeeSort)}
                className="form-input h-9 w-36 text-xs"
                aria-label="Sort payees"
              >
                <option value="spent">Highest spend</option>
                <option value="name">Name A–Z</option>
                <option value="recent">Recently paid</option>
                <option value="payments">Most payments</option>
              </select>
            </div>
          )}

          {/* CTA Add Button */}
          {activeTab === 'payees' && (
            <button
              onClick={openAddModal}
              className="btn btn-primary h-9 px-4 gap-1.5 shadow-xs cursor-pointer text-xs text-white"
            >
              <Plus size={16} />
              <span>Add Payee</span>
            </button>
          )}
          {activeTab === 'categories' && (
            <button
              onClick={() => {
                setEditingCategory(null);
                setCategoryName('');
                setCategorySortOrder(0);
                setCategoryAliases('');
                setCategoryNote('');
                setCategoryActive(true);
                setCategoryModalOpen(true);
              }}
              className="btn btn-primary h-9 px-4 gap-1.5 shadow-xs cursor-pointer text-xs text-white"
            >
              <Plus size={16} />
              <span>Add Category</span>
            </button>
          )}
          {activeTab === 'methods' && (
            <button
              onClick={() => {
                setEditingMethod(null);
                setMethodDisplayName('');
                setMethodCode('');
                setMethodActive(true);
                setMethodModalOpen(true);
              }}
              className="btn btn-primary h-9 px-4 gap-1.5 shadow-xs cursor-pointer text-xs text-white"
            >
              <Plus size={16} />
              <span>Add Method</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content View */}
      {activeTab === 'payees' && (
        <div className="ledger-card bg-white p-0 border border-[#DDE3EC] rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F6F8FC] border-b border-[#DDE3EC] text-xs uppercase font-bold text-[#667085]">
                <tr>
                  <th className="py-3.5 px-5 w-12 text-center">Fav</th>
                  <th className="py-3.5 px-5">Payee Name</th>
                  <th className="py-3.5 px-5 text-center">Payments</th>
                  <th className="py-3.5 px-5 text-right">This Month</th>
                  <th className="py-3.5 px-5 text-right">Total Spent</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE3EC]">
                {sortedPayees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#667085]">
                      <Inbox size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="font-semibold text-base">No payees found</p>
                      <p className="text-xs mt-1">Add a new payee to start tracking payments.</p>
                    </td>
                  </tr>
                ) : (
                  visiblePayees.map((payee) => (
                    <tr
                      key={payee.id}
                      onClick={() => navigate(`/payees/${payee.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          navigate(`/payees/${payee.id}`);
                        }
                      }}
                      tabIndex={0}
                      className={`clickable-table-row transition-colors cursor-pointer ${
                        payee.active === false
                          ? 'bg-slate-100/70 text-slate-500 opacity-60 grayscale'
                          : 'hover:bg-[#F6F8FC]'
                      }`}
                    >
                      {/* Favourite Star Toggle */}
                      <td className="py-3.5 px-5 text-center">
                        <button
                          onClick={(e) => toggleFavorite(e, payee)}
                          aria-label={`${payee.favourite ? 'Remove' : 'Add'} ${payee.name} ${payee.favourite ? 'from' : 'to'} favourites`}
                          className="p-1 hover:scale-110 transition-transform cursor-pointer"
                        >
                          <Star
                            size={18}
                            className={
                              payee.favourite
                                ? 'text-amber-500 fill-amber-500'
                                : 'text-slate-300 hover:text-amber-400'
                            }
                          />
                        </button>
                      </td>

                      {/* Payee Name with Initial Avatar */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <PayeeAvatar name={payee.name} size={34} />
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#111827] block text-base">{payee.name}</span>
                            {payee.active === false && (
                              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700 rounded-md">
                                Archived
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Payment Count */}
                      <td className="py-3.5 px-5 text-center font-semibold text-[#111827]">
                        {payee.paymentCount}
                      </td>

                      {/* This Month Spent Column */}
                      <td className="py-3.5 px-5 text-right font-bold tabular-nums text-slate-700 text-sm">
                        {formatInr(payee.thisMonthPaidPaise)}
                      </td>

                      {/* Total Spent Column (Right-aligned 600 weight Tabular Nums) */}
                      <td className="py-3.5 px-5 text-right font-bold tabular-nums text-[#111827] text-base">
                        {formatInr(payee.totalPaidPaise)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {payee.active === false ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRestorePayee(payee);
                              }}
                              aria-label={`Unarchive ${payee.name}`}
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="Unarchive / Restore Payee"
                            >
                              <RotateCcw size={16} />
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleArchivePayee(payee);
                              }}
                              aria-label={`Archive ${payee.name}`}
                              className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                              title="Archive Payee"
                            >
                              <Inbox size={16} />
                            </button>
                          )}
                          <button
                            onClick={(e) => openEditModal(e, payee)}
                            aria-label={`Edit ${payee.name}`}
                            className="p-1.5 text-[#667085] hover:text-[#165DFF] hover:bg-[#E9F1FF] rounded-lg transition-colors cursor-pointer"
                            title="Edit Payee"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMergingPayee(payee);
                            }}
                            aria-label={`Merge ${payee.name}`}
                            className="p-1.5 text-[#667085] hover:text-[#165DFF] hover:bg-[#E9F1FF] rounded-lg transition-colors cursor-pointer"
                            title="Merge this payee into another"
                          >
                            <GitMerge size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePayee(payee);
                            }}
                            aria-label={`Delete ${payee.name}`}
                            className="p-1.5 text-[#667085] hover:text-[#FF2638] hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Permanently Delete Payee"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {sortedPayees.length > 0 && (
            <div className="flex items-center justify-between border-t border-[#DDE3EC] bg-[#FAFBFD] px-5 py-3 text-xs text-[#667085]">
              <span>
                {(payeePage - 1) * payeePageSize + 1}–{Math.min(payeePage * payeePageSize, sortedPayees.length)} of {sortedPayees.length} payees
              </span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPayeePage((page) => Math.max(1, page - 1))} disabled={payeePage === 1} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DDE3EC] bg-white hover:border-[#165DFF] hover:text-[#165DFF] disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={15} /></button>
                <span className="min-w-20 text-center font-semibold text-[#344054]">Page {payeePage} of {payeePageCount}</span>
                <button type="button" onClick={() => setPayeePage((page) => Math.min(payeePageCount, page + 1))} disabled={payeePage === payeePageCount} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#DDE3EC] bg-white hover:border-[#165DFF] hover:text-[#165DFF] disabled:opacity-40" aria-label="Next page"><ChevronRight size={15} /></button>
              </div>
            </div>
          )}
        </div>
      )}


      {/* Categories View */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredCategories.map((cat) => (
            <div key={cat.id} className="ledger-card bg-white p-4 border border-[#DDE3EC] rounded-xl flex items-center justify-between shadow-xs">
              <div>
                <span className="font-bold text-[#111827] block text-base">{cat.name}</span>
                <span className="text-xs text-[#667085]">Sort Order: {cat.sortOrder} · {cat.active ? 'Active' : 'Inactive'}</span>
                {cat.note && <p className="mt-1 max-w-sm text-xs text-[#667085]">{cat.note}</p>}
                {cat.aliases.length > 0 && (
                  <div className="mt-2 flex max-w-sm flex-wrap gap-1">
                    {cat.aliases.slice(0, 6).map((alias) => (
                      <span key={alias} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-[#667085]">{alias}</span>
                    ))}
                    {cat.aliases.length > 6 && (
                      <span className="rounded-md bg-[#E9F1FF] px-1.5 py-0.5 text-[10px] font-semibold text-[#165DFF]">+{cat.aliases.length - 6} more</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingCategory(cat);
                    setCategoryName(cat.name);
                    setCategorySortOrder(cat.sortOrder);
                    setCategoryAliases(cat.aliases.join(', '));
                    setCategoryNote(cat.note);
                    setCategoryActive(cat.active);
                    setCategoryModalOpen(true);
                  }}
                  className="p-1.5 text-[#667085] hover:text-[#165DFF] hover:bg-[#E9F1FF] rounded-lg transition-colors cursor-pointer"
                  title="Edit category"
                >
                  <Edit size={14} />
                </button>
                <button
                  onClick={() => handleDeleteCategory(cat)}
                  className="p-1.5 text-[#667085] hover:text-[#FF2638] hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  title="Delete category"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payment Methods View */}
      {activeTab === 'methods' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredMethods.map((method) => (
            <div key={method.id} className="ledger-card bg-white p-4 border border-[#DDE3EC] rounded-xl flex items-center justify-between shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#111827] text-base">{method.displayName}</span>
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600 rounded-md">
                    {method.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <span className="font-mono text-xs text-[#667085]">{method.code}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingMethod(method);
                    setMethodDisplayName(method.displayName);
                    setMethodCode(method.code);
                    setMethodActive(method.active);
                    setMethodModalOpen(true);
                  }}
                  className="p-1.5 text-[#667085] hover:text-[#165DFF] hover:bg-[#E9F1FF] rounded-lg transition-colors cursor-pointer"
                  title="Edit payment method"
                >
                  <Edit size={14} />
                </button>
                <button
                  onClick={() => handleDeleteMethod(method)}
                  className="p-1.5 text-[#667085] hover:text-[#FF2638] hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  title="Delete payment method"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payee Detail Drawer */}
      <PayeeDrawer
        payee={selectedPayee}
        onClose={() => setSelectedPayee(null)}
      />

      {/* Payee Add/Edit Modal */}
      {payeeModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-xl font-bold text-[#111827]">
              {editingPayee ? `Edit Payee: ${editingPayee.name}` : 'Create New Payee'}
            </h2>

            <form onSubmit={handleSavePayee} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#667085] block mb-1">
                  Payee Name *
                </label>
                <input
                  type="text"
                  required
                  value={payeeName}
                  onChange={(e) => setPayeeName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar or ABC Tools"
                  className="form-input"
                />
              </div>



              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#667085] block mb-1">
                  Aliases (comma separated)
                </label>
                <input
                  type="text"
                  value={aliases}
                  onChange={(e) => setAliases(e.target.value)}
                  placeholder="e.g. Ramesh, Rameshji"
                  className="form-input"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#667085] block mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes or contact details..."
                  className="form-input h-auto py-2"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="favCheck"
                  checked={favourite}
                  onChange={(e) => setFavourite(e.target.checked)}
                  className="w-4 h-4 rounded border-[#DDE3EC] text-[#165DFF]"
                />
                <label htmlFor="favCheck" className="text-sm font-medium text-[#111827]">
                  Mark as Favourite Payee
                </label>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#DDE3EC]">
                {editingPayee ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDeletePayee(editingPayee)}
                      className="btn border-red-200 text-red-600 hover:bg-red-50 h-10 px-3 flex items-center gap-1.5 text-xs font-semibold"
                    >
                      <Trash2 size={14} />
                      {editingPayee.paymentCount > 0 ? 'Archive' : 'Delete'}
                    </button>
                    {editingPayee.paymentCount > 0 && (
                      <button
                        type="button"
                        onClick={() => handleForceDeletePayee(editingPayee)}
                        className="btn border-red-300 text-white bg-red-600 hover:bg-red-700 h-10 px-3 flex items-center gap-1.5 text-xs font-semibold"
                        title={`Erases ${editingPayee.paymentCount} transaction(s) and their audit history permanently`}
                      >
                        Delete forever…
                      </button>
                    )}
                  </div>
                ) : <div />}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPayeeModalOpen(false)}
                    className="btn btn-secondary h-10 px-4"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPayee}
                    className="btn btn-primary h-10 px-5"
                  >
                    {savingPayee ? 'Saving...' : 'Save Payee'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Add/Edit Modal */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-xl font-bold text-[#111827]">
              {editingCategory ? `Edit Category: ${editingCategory.name}` : 'Create New Category'}
            </h2>
            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#667085] block mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="e.g. Subcontractors, Utilities"
                  className="form-input"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#667085] block mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={categorySortOrder}
                  onChange={(e) => setCategorySortOrder(Number(e.target.value))}
                  placeholder="0"
                  className="form-input"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#667085] block mb-1">Aliases (comma separated)</label>
                <textarea rows={3} value={categoryAliases} onChange={(e) => setCategoryAliases(e.target.value)} className="form-input h-auto py-2" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#667085] block mb-1">Note</label>
                <textarea rows={3} value={categoryNote} onChange={(e) => setCategoryNote(e.target.value)} className="form-input h-auto py-2" />
              </div>
              <div className="flex items-center gap-2">
                <input id="categoryActiveCheck" type="checkbox" checked={categoryActive} onChange={(e) => setCategoryActive(e.target.checked)} />
                <label htmlFor="categoryActiveCheck" className="text-sm font-medium text-[#111827]">Active (available in payment entry)</label>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#DDE3EC]">
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(false)}
                  className="btn btn-secondary h-10 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="btn btn-primary h-10 px-5 text-white"
                >
                  {savingCategory ? 'Saving...' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Method Add/Edit Modal */}
      {methodModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-xl font-bold text-[#111827]">
              {editingMethod ? `Edit Method: ${editingMethod.displayName}` : 'Create New Payment Method'}
            </h2>
            <form onSubmit={handleSaveMethod} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#667085] block mb-1">
                  Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={methodDisplayName}
                  onChange={(e) => setMethodDisplayName(e.target.value)}
                  placeholder="e.g. Google Pay, HDFC Credit Card"
                  className="form-input"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#667085] block mb-1">
                  Code *
                </label>
                <input
                  type="text"
                  required
                  value={methodCode}
                  onChange={(e) => setMethodCode(e.target.value)}
                  placeholder="e.g. gpay, card"
                  className="form-input font-mono"
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="methodActiveCheck"
                  checked={methodActive}
                  onChange={(e) => setMethodActive(e.target.checked)}
                  className="w-4 h-4 rounded border-[#DDE3EC] text-[#165DFF]"
                />
                <label htmlFor="methodActiveCheck" className="text-sm font-medium text-[#111827]">
                  Active (available in quick entry)
                </label>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#DDE3EC]">
                <button
                  type="button"
                  onClick={() => setMethodModalOpen(false)}
                  className="btn btn-secondary h-10 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingMethod}
                  className="btn btn-primary h-10 px-5 text-white"
                >
                  {savingMethod ? 'Saving...' : 'Save Method'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Payee Merge Modal */}
      {mergingPayee && (
        <MergePayeeModal
          source={mergingPayee}
          payees={payees}
          onClose={() => setMergingPayee(null)}
          onMerged={() => setMergingPayee(null)}
        />
      )}
      {/* Dynamic ConfirmModal */}
      <ConfirmModal
        isOpen={confirmModalConfig.isOpen}
        title={confirmModalConfig.title}
        description={confirmModalConfig.description}
        type={confirmModalConfig.type}
        confirmText={confirmModalConfig.confirmText}
        previewData={confirmModalConfig.previewData}
        phraseToConfirm={confirmModalConfig.phraseToConfirm}
        onConfirm={confirmModalConfig.onConfirm}
        onCancel={() => setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}