/**
 * ObservationField — textarea NÃO controlado (defaultValue).
 *
 * O React nunca reescreve o valor, por isso o cursor nunca salta para o fim
 * (bug T14). A persistência no store/Supabase é feita via onChange, de forma
 * desacoplada da renderização. Deve ser montado com uma `key` estável por
 * critério+banco para reinicializar o valor ao trocar de banco.
 */
interface Props {
  initial: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  rows?: number;
  onChange: (value: string) => void;
}

export function ObservationField({ initial, disabled, placeholder, className, rows = 2, onChange }: Props) {
  return (
    <textarea
      defaultValue={initial}
      disabled={disabled}
      rows={rows}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className={className}
    />
  );
}
