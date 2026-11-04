import { Fragment } from 'react';
import { useAssets, useCategories } from '@/api/queries';
import { PageHeader, Card, LoadingBlock } from '@/components/ui/primitives';
import { Table, Th, Td } from '@/components/ui/Table';
import { formatIDR, formatPercent } from '@/lib/format';

export default function BookValueReportPage() {
  const { data: assets, isLoading } = useAssets();
  const { data: categories } = useCategories();

  if (isLoading || !assets || !categories) return <LoadingBlock />;

  const active = assets.filter((a) => a.status === 'active');
  const grand = {
    cost: active.reduce((s, a) => s + a.acquisition_cost, 0),
    accum: active.reduce((s, a) => s + a.accumulated_depreciation, 0),
    book: active.reduce((s, a) => s + a.book_value, 0),
  };

  return (
    <div>
      <PageHeader
        title="Laporan Nilai Buku Aset"
        description="Nilai perolehan, akumulasi depresiasi, dan nilai buku per kategori."
      />
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Kategori / Aset</Th>
              <Th align="right">Nilai Perolehan</Th>
              <Th align="right">Akum. Depresiasi</Th>
              <Th align="right">Nilai Buku</Th>
              <Th align="right">% Tersusut</Th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => {
              const items = active.filter((a) => a.category_id === cat.id);
              if (items.length === 0) return null;
              const sub = {
                cost: items.reduce((s, a) => s + a.acquisition_cost, 0),
                accum: items.reduce((s, a) => s + a.accumulated_depreciation, 0),
                book: items.reduce((s, a) => s + a.book_value, 0),
              };
              return (
                <Fragment key={cat.id}>
                  <tr className="bg-primary-light/40">
                    <Td className="font-bold text-text-strong">{cat.name}</Td>
                    <Td align="right" className="font-mono font-semibold">{formatIDR(sub.cost)}</Td>
                    <Td align="right" className="font-mono font-semibold">{formatIDR(sub.accum)}</Td>
                    <Td align="right" className="font-mono font-semibold">{formatIDR(sub.book)}</Td>
                    <Td align="right" className="font-semibold">{formatPercent(sub.cost ? (sub.accum / sub.cost) * 100 : 0)}</Td>
                  </tr>
                  {items.map((a) => (
                    <tr key={a.id} className="hover:bg-primary-light/30">
                      <Td className="pl-8">
                        <span className="text-text-default">{a.name}</span>
                        <span className="ml-2 font-mono text-xs text-text-muted">{a.code}</span>
                      </Td>
                      <Td align="right" className="font-mono text-text-muted">{formatIDR(a.acquisition_cost)}</Td>
                      <Td align="right" className="font-mono text-text-muted">{formatIDR(a.accumulated_depreciation)}</Td>
                      <Td align="right" className="font-mono">{formatIDR(a.book_value)}</Td>
                      <Td align="right" className="text-text-muted">
                        {formatPercent(a.acquisition_cost ? (a.accumulated_depreciation / a.acquisition_cost) * 100 : 0)}
                      </Td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border-default">
              <Td className="text-base font-bold text-text-strong">Total Keseluruhan</Td>
              <Td align="right" className="font-mono text-base font-bold text-text-strong">{formatIDR(grand.cost)}</Td>
              <Td align="right" className="font-mono text-base font-bold text-text-strong">{formatIDR(grand.accum)}</Td>
              <Td align="right" className="font-mono text-base font-bold text-primary">{formatIDR(grand.book)}</Td>
              <Td align="right" className="font-bold">{formatPercent(grand.cost ? (grand.accum / grand.cost) * 100 : 0)}</Td>
            </tr>
          </tfoot>
        </Table>
      </Card>
    </div>
  );
}
