import styles from "./Header.module.css";

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.brand}>Библиография</div>
        <nav className={styles.nav}>
          <a href="#">Публикации</a>
          <a href="#">Авторы</a>
          <a href="#">О проекте</a>
        </nav>
      </div>
    </header>
  );
}
