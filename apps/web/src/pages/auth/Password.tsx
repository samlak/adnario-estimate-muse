import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

export function Password({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [shown, setShown] = useState(false);
  return (
    <>
      <input
        className="input h-[44px] pl-11 pr-11"
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
      <button
        type="button"
        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7b848e]"
        onClick={() => setShown(!shown)}
        title={shown ? 'Hide password' : 'Show password'}
      >
        {shown ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </>
  );
}
