import { type ReactNode } from 'react';
import { AuthSide } from './AuthSide';

export function AuthLayout({ children, top }: { children: ReactNode; top?: ReactNode }) {
  return (
    <div className="compact flex overflow-hidden">
      <AuthSide />
      <main className="thin-scroll relative h-full flex-1 overflow-y-auto bg-paper">
        {top}
        <div className="flex min-h-full flex-col items-center justify-center px-4 py-10">{children}</div>
      </main>
    </div>
  );
}
