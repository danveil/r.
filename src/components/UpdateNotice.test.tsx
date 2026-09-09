import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { UpdateNotice } from './UpdateNotice';
const worker = vi.hoisted(() => ({
  refresh: true,
  offline: false,
  update: vi.fn(async () => {}),
  dismiss: vi.fn(),
}));
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [worker.refresh, worker.dismiss],
    offlineReady: [worker.offline, worker.dismiss],
    updateServiceWorker: worker.update,
  }),
}));
beforeEach(() => {
  worker.refresh = true;
  worker.offline = false;
  worker.update.mockClear();
  worker.dismiss.mockClear();
});
it('does not offer an update while a form is open', () => {
  render(<UpdateNotice formOpen />);
  expect(screen.queryByRole('button', { name: 'Update now' })).toBeNull();
  expect(worker.update).not.toHaveBeenCalled();
});
it('updates only after the user chooses Update now', async () => {
  render(<UpdateNotice formOpen={false} />);
  expect(worker.update).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Update now' }));
  expect(worker.update).toHaveBeenCalledWith(true);
});
it('allows postponing without reloading', async () => {
  render(<UpdateNotice formOpen={false} />);
  await userEvent.click(screen.getByRole('button', { name: 'Later' }));
  expect(worker.dismiss).toHaveBeenCalledWith(false);
  expect(worker.update).not.toHaveBeenCalled();
});
it('offers a dismissible offline-ready message', () => {
  worker.refresh = false;
  worker.offline = true;
  render(<UpdateNotice formOpen={false} />);
  expect(screen.getByText('Ready to use offline.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument();
});
