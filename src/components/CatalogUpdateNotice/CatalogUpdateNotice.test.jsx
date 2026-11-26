import { render, screen } from '@testing-library/react';
import { CATALOG_UPDATE_FAILED_LABEL } from '../../app/catalogBootstrap';
import CatalogUpdateNotice from './CatalogUpdateNotice';

describe('CatalogUpdateNotice', () => {
  test('пустая строка ничего не рисует', () => {
    const { container } = render(<CatalogUpdateNotice message="" />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('показывает ровно «Каталог не обновился»', () => {
    render(<CatalogUpdateNotice message={CATALOG_UPDATE_FAILED_LABEL} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Каталог не обновился'
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/вчера|неактуальн/i)).toBeNull();
  });
});
