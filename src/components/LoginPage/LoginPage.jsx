import React, { useEffect, useRef, useState } from 'react';
import { Button, Form, Input } from 'antd';
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { loginRedirectFrom } from '../../app/paths';
import { useAuth } from '../../auth/AuthContext';
import './LoginPage.scss';

const ERROR_ID = 'login-page-error';
const ERROR_MESSAGE = 'Неверный логин или пароль';

const getInputElement = (ref) => ref?.current?.input ?? ref?.current;

function LoginPage() {
  const { isAuthenticated, signIn } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const redirectTo = loginRedirectFrom(location);
  const [form] = Form.useForm();
  const [authError, setAuthError] = useState(false);
  const emailInputRef = useRef(null);

  useEffect(() => {
    if (isAuthenticated) return undefined;
    const frame = requestAnimationFrame(() => {
      getInputElement(emailInputRef)?.focus?.({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [isAuthenticated]);

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleValuesChange = () => {
    if (authError) setAuthError(false);
  };

  const showAuthError = () => {
    setAuthError(true);
    requestAnimationFrame(() => {
      getInputElement(emailInputRef)?.focus?.({ preventScroll: true });
    });
  };

  const handleFinish = async (values) => {
    try {
      const ok = await signIn(values.email, values.password);
      if (ok) {
        navigate(redirectTo, { replace: true });
        return;
      }
    } catch {
      /* fall through */
    }
    showAuthError();
  };

  const describedBy = authError ? ERROR_ID : undefined;

  return (
    <section className="login-page" aria-labelledby="login-page-title">
      <div className="login-page__card">
        <h1 id="login-page-title" className="login-page__title">
          Вход
        </h1>

        <Form
          form={form}
          name="login"
          layout="vertical"
          requiredMark={false}
          colon={false}
          className="login-page__form"
          onFinish={handleFinish}
          onValuesChange={handleValuesChange}
        >
          <Form.Item
            name="email"
            label="Email"
            htmlFor="login-page-email"
            rules={[
              { required: true, message: 'Введите Email' },
              { type: 'email', message: 'Введите Email в формате name@example.com' },
            ]}
          >
            <Input
              ref={emailInputRef}
              id="login-page-email"
              type="email"
              name="email"
              size="large"
              autoComplete="username"
              placeholder="name@example.com"
              spellCheck={false}
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              aria-invalid={authError || undefined}
              aria-describedby={describedBy}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Пароль"
            htmlFor="login-page-password"
            rules={[{ required: true, message: 'Введите пароль' }]}
          >
            <Input.Password
              id="login-page-password"
              name="password"
              size="large"
              autoComplete="current-password"
              placeholder="Введите пароль"
              aria-invalid={authError || undefined}
              aria-describedby={describedBy}
              iconRender={(visible) =>
                visible ? (
                  <EyeOutlined aria-label="Скрыть пароль" />
                ) : (
                  <EyeInvisibleOutlined aria-label="Показать пароль" />
                )
              }
            />
          </Form.Item>

          <p id={ERROR_ID} className="login-page__error" role="status">
            {authError ? ERROR_MESSAGE : ''}
          </p>

          <Button
            className="login-page__submit"
            type="primary"
            htmlType="submit"
            size="large"
            block
          >
            Войти
          </Button>
        </Form>
      </div>
    </section>
  );
}

export default LoginPage;
