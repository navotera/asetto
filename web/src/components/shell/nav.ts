export interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Extra path prefixes that should also light this item up. */
  match?: string[];
  /** Permission required to see this item (omitted = always visible). */
  perm?: string;
}
export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    title: 'Ringkasan',
    items: [
      { href: '/', label: 'Dashboard', icon: '▦', perm: 'asset.read' },
      { href: '/aset-saya', label: 'Aset Saya', icon: '◱', perm: 'asset.read_own' },
    ],
  },
  {
    title: 'Aset',
    items: [
      { href: '/aset', label: 'Daftar Aset', icon: '▣', match: ['/aset'], perm: 'asset.read' },
      { href: '/kategori', label: 'Kategori Aset', icon: '⊞', perm: 'asset.read' },
    ],
  },
  {
    title: 'Depresiasi',
    items: [
      { href: '/depresiasi', label: 'Jalankan Depresiasi', icon: '↘', perm: 'depreciation.run' },
      { href: '/depresiasi/riwayat', label: 'Riwayat Run', icon: '↻', perm: 'asset.read' },
    ],
  },
  {
    title: 'Integrasi',
    items: [{ href: '/akunta', label: 'Outbox Jurnal Akunta', icon: '⤤', perm: 'journal.read' }],
  },
  {
    title: 'Laporan',
    items: [{ href: '/laporan/nilai-buku', label: 'Nilai Buku Aset', icon: '∑', perm: 'asset.read' }],
  },
  {
    title: 'Lainnya',
    items: [{ href: '/pengaturan', label: 'Pengaturan', icon: '⚙' }],
  },
];
