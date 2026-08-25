import { act, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import CatalogResultsFade from './CatalogResultsFade';
import { CATALOG_SURFACE_FADE_MS } from './catalogSurfaceFade';

function Harness({ hold = false }) {
  const [view, setView] = useState('a');
  return (
    <>
      <button type="button" onClick={() => setView(view === 'a' ? 'b' : 'a')}>
        toggle
      </button>
      <CatalogResultsFade viewKey={view} hold={hold}>
        {view === 'a' ? <div>View A</div> : <div>View B</div>}
      </CatalogResultsFade>
    </>
  );
}

describe('CatalogResultsFade', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('первый кадр показывает текущий вид без задержки', () => {
    render(
      <CatalogResultsFade viewKey="a">
        <div>View A</div>
      </CatalogResultsFade>
    );
    expect(screen.getByText('View A')).toBeInTheDocument();
  });

  test('смена viewKey держит старое до конца exit, затем монтирует новое', () => {
    jest.useFakeTimers();
    render(<Harness />);
    expect(screen.getByText('View A')).toBeInTheDocument();

    act(() => {
      screen.getByRole('button', { name: 'toggle' }).click();
    });
    expect(screen.getByText('View A')).toBeInTheDocument();
    expect(screen.queryByText('View B')).not.toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(CATALOG_SURFACE_FADE_MS - 1);
    });
    expect(screen.getByText('View A')).toBeInTheDocument();
    expect(screen.queryByText('View B')).not.toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.queryByText('View A')).not.toBeInTheDocument();
    expect(screen.getByText('View B')).toBeInTheDocument();
  });

  test('prefers-reduced-motion меняет вид сразу', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = (query) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    });

    render(<Harness />);
    act(() => {
      screen.getByRole('button', { name: 'toggle' }).click();
    });
    expect(screen.queryByText('View A')).not.toBeInTheDocument();
    expect(screen.getByText('View B')).toBeInTheDocument();

    window.matchMedia = originalMatchMedia;
  });
});
