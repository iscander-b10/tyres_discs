import React, { useEffect, useRef, useState } from 'react';
import { Button, Form, Input, Modal } from 'antd';
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { resolveLoginDismissPath, resolvePostLoginPath } from '../../app/paths';
import { useAuth } from '../../auth/AuthContext';
import './LoginPage.scss';

const ERROR_ID = 'login-page-error';
const ERROR_MESSAGE = 'Неверный логин или пароль';

const getInputElement = (ref) => ref?.current?.input ?? ref?.current;

function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function LoginPage() {
  const { isAuthenticated, signIn } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const redirectTo = resolvePostLoginPath(location);
  const [form] = Form.useForm();
  const [authError, setAuthError] = useState(false);
  const [reducedMotion] = useState(prefersReducedMotion);
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

  const handleDismiss = () => {
    navigate(resolveLoginDismissPath(location), { replace: true });
  };

  const describedBy = authError ? ERROR_ID : undefined;
  const motionNames = reducedMotion
    ? { transitionName: '', maskTransitionName: '' }
    : {};

  return (
    <Modal
      open
      centered
      footer={null}
      closable={false}
      maskClosable
      keyboard
      onCancel={handleDismiss}
      width={420}
      zIndex={1300}
      rootClassName="login-page"
      classNames={{
        mask: 'login-page__mask',
        content: 'login-page__dialog',
        body: 'login-page__body',
      }}
      styles={{
        mask: { background: 'var(--color-overlay)' },
      }}
      aria-labelledby="login-page-title"
      {...motionNames}
    >
      <header className="login-page__header">
        <h1 id="login-page-title" className="login-page__title">
          Вход
        </h1>
      </header>

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
    </Modal>
  );
}

export default LoginPage;
