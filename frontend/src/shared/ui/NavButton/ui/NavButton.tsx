import { Icon } from '@/shared/ui/Icon';  // Импортируем компонент Icon
import styles from './NavButton.module.css';

type NavButtonProps = {
  label: string;
  icon: string;  // Путь к иконке
  onClick: () => void;
};

export const NavButton: React.FC<NavButtonProps> = ({ label, icon, onClick }) => {
  return (
    <div className={styles.navButton} onClick={onClick}>
      <div className={styles.iconContainer}>
        {/* Используем компонент Icon */}
        <Icon name={icon} className={styles.icon} width={20} height={20} />
      </div>
      <div className={styles.labelText}>{label}</div>
    </div>
  );
};