import { useEffect, useState } from 'react';
import { useSaveEntity } from '@/api/queries';
import { Modal } from '@/components/ui/Modal';
import { Button, Field, Input, Spinner } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import type { Entity } from '@/api/types';

export function EntityFormModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (entity: Entity) => void;
}) {
  const save = useSaveEntity();
  const toast = useToast();
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) setName('');
  }, [open]);

  async function submit() {
    if (!name.trim()) {
      toast('error', 'Nama entitas wajib diisi.');
      return;
    }
    try {
      const entity = await save.mutateAsync({ name: name.trim() });
      toast('success', 'Entitas ditambahkan.');
      onCreated?.(entity);
      onClose();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Gagal menambah entitas.');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tambah Entitas"
      description="Perusahaan (PT) yang aset & jurnalnya dipisahkan. Id entitas ini dipetakan admin Akunta ke entitas Akunta lewat Auto Mapping."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <Spinner />} Simpan
          </Button>
        </>
      }
    >
      <Field label="Nama Entitas">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="mis. PT Mitra Sejahtera"
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          autoFocus
        />
      </Field>
    </Modal>
  );
}
