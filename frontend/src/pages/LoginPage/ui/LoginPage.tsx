import { useEffect, useState, type FormEvent } from 'react';

import styles from './LoginPage.module.css';
import { Header } from '@/widgets/Header';
import { Footer } from '@/widgets/Footer';
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/TextField';
import { navigateTo } from '@/shared/lib/navigation';
import { useAuth } from '@/features/auth';

export function LoginPage() {
  const { login, isAuthenticated, isInitializing } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      navigateTo('/');
    }
  }, [isAuthenticated, isInitializing]);

  const usernameError = !username.trim() && Boolean(submitError);
  const passwordError = !password.trim() && Boolean(submitError);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError('');

    if (!username.trim() || !password.trim()) {
      setSubmitError('Введите логин и пароль.');
      return;
    }

    try {
      setIsSubmitting(true);

      await login({
        username: username.trim(),
        password,
      });

      navigateTo('/');
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Не удалось выполнить вход.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-page">
      <Header title="Авторизация" authActionVariant="hidden" />

      <main className="app-main">
        <div className="container app-block-group">
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h1 className={styles.title}>Вход в систему</h1>
              <p className={styles.subtitle}>
                Используйте логин и пароль вашей учётной записи.
              </p>
            </div>

            <form className={styles.form} onSubmit={handleSubmit}>
              <TextField
                label="Логин"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                disabled={isSubmitting}
                error={usernameError}
                errorText={usernameError ? 'Введите логин.' : undefined}
                autoComplete="username"
                name="username"
              />

              <TextField
                label="Пароль"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting}
                error={passwordError}
                errorText={passwordError ? 'Введите пароль.' : undefined}
                autoComplete="current-password"
                name="password"
              />

              {submitError && !usernameError && !passwordError ? (
                <div className={styles.errorText}>{submitError}</div>
              ) : null}

              <div className={styles.actions}>
                <Button
                  type="submit"
                  size="normal"
                  label={isSubmitting ? 'Выполняется вход...' : 'Войти'}
                  disabled={isSubmitting}
                />
              </div>
            </form>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
