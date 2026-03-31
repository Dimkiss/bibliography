import { useState } from 'react';
import styles from './Header.module.css';
import { Icon } from '@/shared/ui/Icon';
import { NavButton } from '@/shared/ui/NavButton';
import { OutlineButton } from '@/shared/ui/OutlineButton';

const navItems = [
  { id: 'home', label: 'Главная', iconName: 'main-page' },
  { id: 'articles', label: 'Публикации', iconName: 'article-outline' },
  { id: 'journals', label: 'Издания', iconName: 'journal-outline' },
  { id: 'help', label: 'Справка', iconName: 'help-outline' },
  { id: 'about', label: 'О проекте', iconName: 'info-outline' },
] as const;

type HeaderProps = {
  title: string;
};

export function Header({ title }: HeaderProps) {
  const [activeItem, setActiveItem] = useState<string>('home');

  return (
    <header className={styles.header}>
      <div className={styles.logoWrap}>
        <Icon name="lin-color" size={96} colored className={styles.logo} />
      </div>

      <div className={styles.supheader}>
        <div className={styles.inner}>
          <div className={styles.leftSpacer} />

          <nav className={styles.nav} aria-label="Основная навигация">
            {navItems.map((item) => (
              <NavButton
                key={item.id}
                iconName={item.iconName}
                label={item.label}
                selected={activeItem === item.id}
                onClick={() => setActiveItem(item.id)}
              />
            ))}
          </nav>

          <div className={styles.actions}>
          <OutlineButton
            className={styles.headerLoginButton}
            size="normal"
            iconName="log-in"
            label="Вход"
            onClick={() => {}}
          />
          </div>
        </div>
      </div>

      <div className={styles.subheader}>
        <div className={styles.subheaderTitle}>{title}</div>
      </div>
    </header>
  );
}