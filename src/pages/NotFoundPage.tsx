/**
 * 404 page.
 *
 * Keeps the shell and offers a way back, rather than a bare error string.
 */

import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

import { Button, Card } from '@/components/ui';

export function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <Card className="w-full p-8">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-cgci-50 text-cgci-700">
          <Compass size={24} aria-hidden="true" />
        </span>
        <p className="mt-4 text-sm font-medium tracking-wide text-ink-500 uppercase">
          Error 404
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink-900">Page not found</h1>
        <p className="mt-2 text-sm text-ink-600">
          That address does not match any part of the campus navigation system.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link to="/">
            <Button>Back to campus navigation</Button>
          </Link>
          <Link to="/discrete-structures">
            <Button variant="secondary">Discrete Structures</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}