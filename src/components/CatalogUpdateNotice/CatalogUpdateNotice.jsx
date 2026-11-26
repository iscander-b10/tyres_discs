import './CatalogUpdateNotice.scss';

function CatalogUpdateNotice({ message = '' }) {
  if (!message) return null;
  return (
    <p className="catalog-update-notice" role="status">
      {message}
    </p>
  );
}

export default CatalogUpdateNotice;
