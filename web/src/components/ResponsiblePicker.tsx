import { useEntityResponsibles } from '@/api/queries';
import { Select } from '@/components/ui/primitives';

export type ResponsibleValue = { type: 'user' | 'team' | null; id: string | null };

/**
 * Picks an asset's responsible party — a user OR a team of the given entity.
 * Options are grouped (Team / User); the empty option clears it.
 */
export function ResponsiblePicker({
  entityId,
  value,
  onChange,
  disabled,
}: {
  entityId: string | null;
  value: ResponsibleValue;
  onChange: (v: ResponsibleValue) => void;
  disabled?: boolean;
}) {
  const { data } = useEntityResponsibles(entityId);
  const users = data?.users ?? [];
  const teams = data?.teams ?? [];
  const current = value.type && value.id ? `${value.type}:${value.id}` : '';

  return (
    <Select
      value={current}
      disabled={disabled || !entityId}
      onChange={(e) => {
        const v = e.target.value;
        if (!v) return onChange({ type: null, id: null });
        const [type, id] = v.split(':');
        onChange({ type: type as 'user' | 'team', id });
      }}
    >
      <option value="">— belum ditentukan —</option>
      {teams.length > 0 && (
        <optgroup label="Team">
          {teams.map((t) => (
            <option key={`team:${t.id}`} value={`team:${t.id}`}>{t.name}</option>
          ))}
        </optgroup>
      )}
      {users.length > 0 && (
        <optgroup label="User">
          {users.map((u) => (
            <option key={`user:${u.user_id}`} value={`user:${u.user_id}`}>
              {u.name}{u.email ? ` (${u.email})` : ''}
            </option>
          ))}
        </optgroup>
      )}
    </Select>
  );
}
