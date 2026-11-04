export interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Extra path prefixes that should also light this item up. */
  match?: string[];
}
export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    title: 'Ringkasan',
    items: [{ href: '/', label: 'Dashboard', icon: '▦' }],
  },
  {
    title: 'Aset',
    items: [
      { href: '/aset', label: 'Daftar Aset', icon: '▣', match: ['/aset'] },
      { href: '/kategori', label: 'Kategori Aset', icon: '⊞' },
    ],
  },
  {
    title: 'Depresiasi',
    items: [
      { href: '/depresiasi', label: 'Jalankan Depresiasi', icon: '↘' },
      { href: '/depresiasi/riwayat', label: 'Riwayat Run', icon: '↻' },
    ],
  },
  {
    title: 'Operasional',
    items: [
      { href: '/kondisi', label: 'Kondisi Aset', icon: '◍' },
      { href: '/pelimpahan', label: 'Pelimpahan', icon: '⇄' },
      { href: '/pelepasan', label: 'Pelepasan & Penjualan', icon: '⊗' },
    ],
  },
  {
    title: 'Integrasi',
    items: [{ href: '/akunta', label: 'Outbox Jurnal Akunta', icon: '⤤' }],
  },
  {
    title: 'Laporan',
    items: [{ href: '/laporan/nilai-buku', label: 'Nilai Buku Aset', icon: '∑' }],
  },
  {
    title: 'Lainnya',
    items: [{ href: '/pengaturan', label: 'Pengaturan', icon: '⚙' }],
  },
];
