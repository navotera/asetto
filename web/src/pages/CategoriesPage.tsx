import { useCategories } from '@/api/queries';
import { PageHeader, Card, LoadingBlock, Badge } from '@/components/ui/primitives';
import { Table, Th, Td, Tr } from '@/components/ui/Table';

const methodLabel: Record<string, string> = {
  straight_line: 'Garis Lurus',
  declining_balance: 'Saldo Menurun',
  none: 'Tanpa Depresiasi',
};

export default function CategoriesPage() {
  const { data: categories, isLoading } = useCategories();

  return (
    <div>
      <PageHeader
        title="Kategori Aset"
        description="Tiap kategori menentukan metode default dan pemetaan akun GL di Akunta."
      />
      <Card>
        {isLoading || !categories ? (
          <LoadingBlock />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Kode</Th>
                <Th>Kategori</Th>
                <Th>Metode Default</Th>
                <Th align="center">Masa Manfaat</Th>
                <Th>Akun Aset</Th>
                <Th>Akum. Depresiasi</Th>
                <Th>Beban Depresiasi</Th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <Tr key={c.id}>
                  <Td className="font-mono">{c.code}</Td>
                  <Td className="font-semibold text-text-strong">{c.name}</Td>
                  <Td><Badge tone="info">{methodLabel[c.default_method]}</Badge></Td>
                  <Td align="center">{c.default_useful_life_months} bln</Td>
                  <Td className="font-mono text-xs">{c.akunta_asset_account}</Td>
                  <Td className="font-mono text-xs">{c.akunta_accum_dep_account}</Td>
                  <Td className="font-mono text-xs">{c.akunta_dep_expense_account}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <p className="mt-3 text-xs text-text-muted">
        Kode akun di atas adalah akun di <strong>Akunta</strong> (general ledger). Asetto tidak menyimpan ledger
        sendiri — ia hanya memetakan peristiwa aset ke akun-akun ini saat posting jurnal.
      </p>
    </div>
  );
}
