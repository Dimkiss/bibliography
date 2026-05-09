import styles from './AboutProjectPage.module.css';
import { Header } from '@/widgets/Header';
import { Footer } from '@/widgets/Footer';

export function AboutProjectPage() {
  return (
    <div className="app-page">
      <Header title="О проекте" />

      <main className="app-main">
        <div className="container app-block-group">
          <section className={styles.content}>
            <p className={styles.kicker}>Библиография ЛИН СО РАН</p>
            <h1 className={styles.title}>О проекте</h1>

            <div className={styles.text}>
              <p>
                Проект предназначен для использования сотрудниками
                Лимнологического института Сибирского отделения Российской
                академии наук. Веб-приложение помогает вести библиографию
                института, искать публикации и работать со сведениями о научных
                материалах.
              </p>

              <p>
                Проект разработан Дмитрием Артемовичем Шергиным, студентом
                ИРНИТУ и сотрудником информационно-аналитического отдела
                ЛИН СО РАН, совместно с Евгением Александровичем Долидом,
                начальником информационно-аналитического отдела ЛИН СО РАН.
              </p>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
