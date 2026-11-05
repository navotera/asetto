import { useEffect, useState } from 'react';
import { useSettings, useSaveSettings } from '@/api/queries';
import { Card, CardHeader, Field, Select, Button, Spinner, LoadingBlock } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { formatWithPattern } from '@/lib/format';

const DATE_FORMATS = [
  { value: 'd F Y', label: 'd F Y (5 November 2026)' },
  { value: 'd M Y', label: 'd M Y (05 Nov 2026)' },
  { value: 'd/m/Y', label: 'd/m/Y (05/11/2026)' },
  { value: 'd-m-Y', label: 'd-m-Y (05-11-2026)' },
  { value: 'Y-m-d', label: 'Y-m-d (2026-11-05)' },
  { value: 'l, d F Y', label: 'l, d F Y (Kamis, 5 November 2026)' },
];

export function GeneralPanel() {
  const { data: settings } = useSettings();
  const save = useSaveSettings();
  const toast = useToast();

  const [timezone, setTimezone] = useState('Asia/Jakarta');
  const [dateFormat, setDateFmt] = useState('d F Y');

  useEffect(() => {
    if (settings?.general) {
      setTimezone(settings.general.timezone);
      setDateFmt(settings.general.date_format);
    }
  }, [settings]);

  if (!settings) {
    return (
      <Card>
        <LoadingBlock />
      </Card>
    );
  }

  const timezones = settings.timezones ?? ['Asia/Jakarta'];
  const formats = DATE_FORMATS.some((f) => f.value === dateFormat)
    ? DATE_FORMATS
    : [...DATE_FORMATS, { value: dateFormat, label: dateFormat }];

  async function saveGeneral() {
    try {
      await save.mutateAsync({ general: { timezone, date_format: dateFormat } });
      toast('success', 'Pengaturan umum disimpan.');
    } catch {
      toast('error', 'Gagal menyimpan.');
    }
  }

  return (
    <Card>
      <CardHeader title="Umum" subtitle="Zona waktu dan format tampilan tanggal." />
      <div className="flex flex-col gap-4 px-5 py-4">
        <Field label="Zona Waktu" hint="Dipakai server untuk tanggal & penjadwalan.">
          <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {timezones.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </Select>
        </Field>
        <Field label="Format Tanggal" hint="Memakai token gaya PHP (d, F, Y, …).">
          <Select value={dateFormat} onChange={(e) => setDateFmt(e.target.value)}>
            {formats.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </Select>
        </Field>
        <div className="rounded-lg bg-primary-light/50 p-3 text-sm">
          <span className="text-text-muted">Pratinjau hari ini: </span>
          <span className="font-semibold text-text-strong">{formatWithPattern(new Date(), dateFormat)}</span>
        </div>
        <div>
          <Button onClick={saveGeneral} disabled={save.isPending}>
            {save.isPending && <Spinner />} Simpan
          </Button>
        </div>
      </div>
    </Card>
  );
}
