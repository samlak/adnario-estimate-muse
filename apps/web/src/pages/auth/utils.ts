const bind = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => ({
  value,
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
});
