import { Link } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';

/** Any address that leads nowhere, and a project that is not one of yours. */
export function NotFound() {
  return (
    <div className="grid min-h-full place-items-center bg-canvas px-4 py-16 text-center">
      <div className="max-w-md">
        <Logo className="mx-auto h-10" />
        <p className="mt-14 text-[150px] font-extrabold leading-none tracking-[-0.04em] text-[#d6dadd]">404</p>
        <h1 className="mt-1 text-[30px] font-bold tracking-[-0.02em]">Page not found</h1>
        <p className="mt-4 text-[15px] leading-[1.6] text-[#6b7581]">This address does not lead to anything you can open. It may have been mistyped, removed, or not shared with you.</p>
        <Link to="/" className="btn-primary mt-8 inline-flex h-[42px] rounded-lg px-5 text-[14.5px]">Back to the dashboard</Link>
      </div>
    </div>
  );
}
