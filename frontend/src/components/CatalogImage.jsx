import { useEffect, useState } from 'react';

export default function CatalogImage({ src, alt, className = '', children }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return <img className={`catalog-photo ${className}`} src={src} alt={alt} onError={() => setFailed(true)} />;
  }

  return children;
}
