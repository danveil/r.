import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { db, deleteAllData, importData, readData } from '../db/database';
import { shift, todayKey } from '../lib/dates';
import { fixtureData, fixturePeriod } from '../test/fixtures';
import { makeBackup, validateData } from '../lib/validation';
import { Onboarding } from './Onboarding';
import { ImportSheet } from './Settings';
vi.mock('../components/UpdateNotice', () => ({ UpdateNotice: () => null }));
const today = todayKey();
const user = () => userEvent.setup();
beforeEach(async () => {
  await deleteAllData();
  window.location.hash = '';
});
async function openExisting(offset = 12, active = false) {
  const data = fixtureData(shift(today, -offset));
  if (active) data.periods[0] = { ...data.periods[0], status: 'active', endDate: undefined };
  await importData(data);
  render(<App />);
  await screen.findByRole('button', { name: 'Open today’s diary' });
}
describe('core interaction flows', () => {
  it('completes onboarding with explicit unknown cycle prior', async () => {
    const onFinish = vi.fn(async (data) => {
      validateData(data);
    });
    render(<Onboarding onFinish={onFinish} onRestore={vi.fn()} />);
    const u = user();
    await u.click(screen.getByRole('button', { name: /Let’s begin/ }));
    fireEvent.change(screen.getByLabelText('First bleeding day'), { target: { value: shift(today, -10) } });
    await u.click(screen.getByRole('button', { name: 'Continue' }));
    await u.click(screen.getByLabelText('It ended, but I don’t remember when'));
    await u.click(screen.getByRole('button', { name: 'Continue' }));
    await u.click(screen.getByLabelText('I don’t know'));
    await u.click(screen.getByRole('button', { name: 'Meet your cycle' }));
    expect(onFinish).toHaveBeenCalledOnce();
    expect(onFinish.mock.calls[0][0].profile.initialTypicalCycleLength).toBeNull();
    expect(onFinish.mock.calls[0][0].periods[0]).toMatchObject({ status: 'end-unknown' });
    expect(onFinish.mock.calls[0][0].periods[0].endDate).toBeUndefined();
  });
  it('starts a period, persists it, and updates the contextual action', async () => {
    await openExisting(28);
    const u = user();
    await u.click(screen.getByRole('button', { name: 'My period started' }));
    await u.click(screen.getByRole('button', { name: 'Save period' }));
    await screen.findByRole('button', { name: 'My period ended' });
    expect((await readData()).periods.find((p) => p.status === 'active')?.startDate).toBe(today);
  });
  it('ends an active period on the selected last bleeding day', async () => {
    await openExisting(2, true);
    const u = user();
    await u.click(screen.getByRole('button', { name: 'My period ended' }));
    fireEvent.change(screen.getByLabelText('Last bleeding day'), { target: { value: shift(today, -1) } });
    await u.click(screen.getByRole('button', { name: 'Save period' }));
    await waitFor(async () => expect((await readData()).periods[0].endDate).toBe(shift(today, -1)));
  });
  it('creates and edits a diary entry without duplicates', async () => {
    await openExisting();
    const u = user();
    await u.click(screen.getByRole('button', { name: 'Open today’s diary' }));
    await u.type(screen.getByLabelText('How did today feel?'), 'Felt pretty good today.');
    await u.click(screen.getByRole('button', { name: 'Energetic' }));
    await u.click(screen.getByRole('button', { name: 'Bloating' }));
    await u.click(screen.getByRole('button', { name: 'Save note' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await u.click(screen.getByRole('button', { name: 'Open today’s diary' }));
    await u.clear(screen.getByLabelText('How did today feel?'));
    await u.type(screen.getByLabelText('How did today feel?'), 'A quieter evening.');
    await u.click(screen.getByRole('button', { name: 'Save note' }));
    await waitFor(async () => expect((await readData()).diary[0].note).toBe('A quieter evening.'));
    expect((await readData()).diary).toHaveLength(1);
  });
  it('protects an unsaved diary from accidental closing', async () => {
    await openExisting();
    const u = user();
    await u.click(screen.getByRole('button', { name: 'Open today’s diary' }));
    await u.type(screen.getByLabelText('How did today feel?'), 'Keep me');
    await u.click(screen.getByRole('button', { name: 'Close' }));
    await u.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByLabelText('How did today feel?')).toHaveValue('Keep me');
  });
  it('selects a calendar date and corrects its historical range', async () => {
    const data = fixtureData(shift(today, -1));
    data.periods[0] = fixturePeriod(shift(today, -1), 1);
    await importData(data);
    render(<App />);
    const u = user();
    await u.click(await screen.findByRole('button', { name: 'Calendar' }));
    const periodButton = screen.getAllByRole('button', { name: /Logged period/ })[0];
    await u.click(periodButton);
    await u.click(screen.getByRole('button', { name: 'Edit period range' }));
    fireEvent.change(screen.getByLabelText('First bleeding day'), { target: { value: shift(today, -2) } });
    await u.click(screen.getByRole('button', { name: 'Save period' }));
    await waitFor(async () => expect((await readData()).periods[0].startDate).toBe(shift(today, -2)));
  });
  it('records an ovulation sign as an observation', async () => {
    await openExisting(12);
    const u = user();
    await u.click(screen.getByRole('button', { name: 'Log ovulation sign' }));
    await u.click(screen.getByRole('button', { name: 'Cervical mucus change' }));
    await u.click(screen.getByRole('button', { name: 'Save sign' }));
    await waitFor(async () => expect((await readData()).observations).toHaveLength(1));
    expect((await readData()).observations[0].indicators).toEqual(['Cervical mucus change']);
  });
  it('exports a JSON download containing the active database', async () => {
    await openExisting();
    const u = user();
    const create = vi.fn(() => 'blob:test');
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
    await u.click(screen.getByRole('button', { name: 'Settings' }));
    await u.click(screen.getByRole('button', { name: 'Export data' }));
    expect(create).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
  });
  it('validates an import before showing the replace action', async () => {
    const onImport = vi.fn(async () => {});
    render(<ImportSheet onClose={vi.fn()} onImport={onImport} />);
    const u = user();
    const invalid = new File(['invalid'], 'bad.json', { type: 'application/json' });
    Object.defineProperty(invalid, 'text', { value: async () => 'invalid' });
    await u.upload(screen.getByLabelText('Backup file'), invalid);
    expect(await screen.findByRole('alert')).toHaveTextContent('not valid JSON');
    expect(onImport).not.toHaveBeenCalled();
    const raw = JSON.stringify(makeBackup(fixtureData()));
    const valid = new File([raw], 'good.json', { type: 'application/json' });
    Object.defineProperty(valid, 'text', { value: async () => raw });
    await u.upload(screen.getByLabelText('Backup file'), valid);
    await u.click(await screen.findByRole('button', { name: 'Replace history with this backup' }));
    expect(onImport).toHaveBeenCalledWith(fixtureData());
  });
  it('requires explicit confirmation to delete all data and recovery', async () => {
    await openExisting();
    const u = user();
    await u.click(screen.getByRole('button', { name: 'Settings' }));
    await u.click(screen.getByRole('button', { name: 'Delete all data' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Permanently delete all data' })).toBeDisabled();
    await u.type(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    await u.click(within(dialog).getByRole('button', { name: 'Permanently delete all data' }));
    await screen.findByRole('button', { name: /Let’s begin/ });
    expect(await db.recovery.count()).toBe(0);
  });
});
