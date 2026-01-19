import styles from "./SearchPanel.module.css";

import { ButtonSplit } from "@/shared/ui/ButtonSplit";
import { TextField } from "@/shared/ui/TextField";
import { IconButton } from "@/shared/ui/IconButton";

export function SearchPanel() {
  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>Поиск публикаций</h2>

      <div className={styles.row}>
        <ButtonSplit className={styles.leftBtn}>Фильтр</ButtonSplit>

        <div className={styles.searchLine}>
          <ButtonSplit className={styles.rightBtn}>Автор</ButtonSplit>

          <div className={styles.fieldWrap}>
            <TextField placeholder="Введите запрос…" />
            <IconButton ariaLabel="Поиск">🔎</IconButton>
          </div>
        </div>
      </div>
    </section>
  );
}
