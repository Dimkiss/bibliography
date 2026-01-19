import React, { useEffect, useState } from 'react';

type IconProps = {
  name: string;  // Имя иконки (например, 'info-outline')
  className?: string;  // Дополнительные классы для стилизации
  width?: number;  // Ширина иконки
  height?: number;  // Высота иконки
};

export const Icon: React.FC<IconProps> = ({ name, className, width = 24, height = 24 }) => {
  const [iconSrc, setIconSrc] = useState<string | null>(null);

  useEffect(() => {
    import(`@/shared/assets/icons/${name}.svg`)
      .then((module) => setIconSrc(module.default))
      .catch((err) => console.error('Ошибка загрузки иконки:', err));
  }, [name]);

  if (!iconSrc) return null;

  return (
    <img
      src={iconSrc}
      alt={name}
      className={className}
      width={width}
      height={height}
    />
  );
};
