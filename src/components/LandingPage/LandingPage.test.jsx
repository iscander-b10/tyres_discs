import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from './LandingPage';
import { PATHS } from '../../app/paths';

jest.mock('../../icons/Phone.svg', () => ({ ReactComponent: () => null }));

describe('LandingPage demo CTA', () => {
  test('Посмотреть демо включена и ведёт на /demo', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    const demoButton = screen.getByRole('button', { name: 'Посмотреть демо' });
    expect(demoButton).not.toBeDisabled();
    expect(demoButton.closest('a')).toHaveAttribute('href', PATHS.demo);
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
  });
});
