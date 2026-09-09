export type IconName =
  | 'home'
  | 'calendar'
  | 'insights'
  | 'settings'
  | 'pen'
  | 'chevron'
  | 'close'
  | 'lock'
  | 'check'
  | 'download'
  | 'upload'
  | 'drop'
  | 'plus';
const paths: Record<IconName, string> = {
  home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  calendar:
    'M7 3v4m10-4v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm3 9h1m6 0h1m-8 4h1',
  insights: 'M5 20v-6m7 6V4m7 16V9',
  settings: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  pen: 'm15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14Z',
  chevron: 'm9 5 7 7-7 7',
  close: 'm6 6 12 12M6 18 18 6',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M6 10h12a2 2 0 0 1 2 2v8H4v-8a2 2 0 0 1 2-2Zm6 5v2',
  check: 'm5 12 4 4L19 6',
  download: 'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
  upload: 'M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4',
  drop: 'M12 3S5 10 5 15a7 7 0 0 0 14 0c0-5-7-12-7-12Z',
  plus: 'M12 5v14M5 12h14',
};
export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
