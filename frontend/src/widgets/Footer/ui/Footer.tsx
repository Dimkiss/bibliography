import styles from './Footer.module.css';

export const Footer: React.FC = () => {  // Используем named export
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <span className={styles.text}>
          © 2000—2025 Федеральное бюджетное учреждение науки Лимнологический институт Сибирского отделения Российской академии наук. Все права защищены
        </span>
      </div>
    </footer>
  );
};
