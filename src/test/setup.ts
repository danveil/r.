import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
afterEach(cleanup);
if (typeof HTMLDialogElement !== 'undefined')
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
if (typeof HTMLDialogElement !== 'undefined')
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
if (typeof window !== 'undefined') window.scrollTo = () => {};
