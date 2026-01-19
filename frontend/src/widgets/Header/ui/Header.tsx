import styles from './Header.module.css';
import { NavButton } from '@/shared/ui/NavButton';

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.brand}>Библиография</div>
        <nav className={styles.nav}>
          <a href="#">Публикации</a>
          <a href="#">Авторы</a>
          <NavButton
            label="О проекте"
            icon="info-outline"
            onClick={() => alert("О проекте нажато")}
          />
        </nav>
      </div>
    </header>
  );
}