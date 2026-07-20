import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  MasterDataCategoryTabs,
  MasterDataDeleteConfirmModal,
  MasterDataFormDrawer,
  MasterDataOptionTable,
} from "../../pages/master-data/components/MasterDataComponents";

const categories = [
  {
    key: "bank-disbursement" as const,
    label: "Bank Disbursement",
    description: "Daftar rekening invoice.",
    activeOptions: 2,
    totalOptions: 3,
  },
  {
    key: "agents" as const,
    label: "Agen",
    description: "Daftar agen operasional.",
    activeOptions: 1,
    totalOptions: 1,
  },
];

describe("master data redesign", () => {
  it("menyajikan kategori ringkas dan dapat dicari", () => {
    const onSelectCategory = vi.fn();
    render(
      <MasterDataCategoryTabs
        categories={categories}
        activeCategoryKey="bank-disbursement"
        onSelectCategory={onSelectCategory}
        isLoading={false}
      />,
    );

    expect(screen.getByText("Opsi sistem")).toBeInTheDocument();
    expect(screen.getByText("Entitas operasional")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Cari kategori master data"), { target: { value: "agen" } });
    expect(screen.queryByRole("button", { name: /Bank Disbursement/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Agen/ }));
    expect(onSelectCategory).toHaveBeenCalledWith("agents");
  });

  it("menampilkan aksi edit dan status dalam Bahasa Indonesia", () => {
    const onEditOption = vi.fn();
    const onDeleteOption = vi.fn();
    render(
      <MasterDataOptionTable
        options={[
          {
            id: "bank-1",
            categoryKey: "bank-disbursement",
            value: "bca",
            label: "BCA IDR",
            sortOrder: 1,
            isActive: true,
            createdAt: "2026-07-19T00:00:00.000Z",
            updatedAt: "2026-07-19T00:00:00.000Z",
          },
        ]}
        isDarkMode={false}
        updatePending={false}
        deletePending={false}
        onToggleActive={vi.fn()}
        onEditOption={onEditOption}
        onDeleteOption={onDeleteOption}
      />,
    );

    expect(screen.getAllByText("Aktif").length).toBeGreaterThan(0);
    expect(screen.getByText("Nama tampilan")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Edit BCA IDR" })[0]);
    expect(onEditOption).toHaveBeenCalledWith("bank-1");
    fireEvent.click(screen.getAllByRole("button", { name: "Hapus BCA IDR" })[0]);
    expect(onDeleteOption).toHaveBeenCalledWith(expect.objectContaining({ id: "bank-1" }));
  });

  it("meminta konfirmasi sebelum menghapus data", () => {
    const onConfirm = vi.fn();
    render(
      <MasterDataDeleteConfirmModal
        isOpen
        itemLabel="BCA IDR"
        itemType="data master"
        isDeleting={false}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Hapus data master" })).toBeInTheDocument();
    expect(screen.getByText(/masih digunakan oleh group/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ya, hapus" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("membuka formulir di drawer dan menutupnya dari tombol header", () => {
    const onClose = vi.fn();
    render(
      <MasterDataFormDrawer
        isOpen
        title="Tambah Bank Disbursement"
        description="Tambahkan rekening baru."
        onClose={onClose}
      >
        <button type="button">Simpan data</button>
      </MasterDataFormDrawer>,
    );

    expect(screen.getByRole("dialog", { name: "Tambah Bank Disbursement" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tutup formulir" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
