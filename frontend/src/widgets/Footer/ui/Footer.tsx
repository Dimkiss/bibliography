import styles from './Footer.module.css';

export const Footer = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        © 2000—2025 Федеральное государственное бюджетное учреждение науки
        Лимнологический институт Сибирского отделения Российской академии наук.
        Все права защищены
      </div>
    </footer>
  );
};