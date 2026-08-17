import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Button, Form, Input } from 'antd';
import { CloseOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import './LoginModal.scss';

const ERROR_ID = 'login-modal-error';
const ERROR_MESSAGE = 'Неверный логин или пароль';

const getInputElement = (ref) => ref?.current?.input ?? ref?.current;

const LoginModal = ({ isOpen, onClose, onSubmit }) => {
  const [form] = Form.useForm();
  const [authError, setAuthError] = useState(false);
  const dialogRef = useRef(null);
  const emailInputRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    previouslyFocusedRef.current = document.activeElement;
    document.body.style.overflow = 'hidden';
    const appRoot = document.getElementById('root');
    appRoot?.setAttribute('inert', '');

    requestAnimationFrame(() => {
      getInputElement(emailInputRef)?.focus?.({ preventScroll: true });
    });

    return () => {
      document.body.style.overflow = '';
      appRoot?.removeAttribute('inert');
      previouslyFocusedRef.current?.focus?.({ preventScroll: true });
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const nodes = Array.from(focusable).filter(
        (node) => !node.hasAttribute('disabled') && node.getAttribute('aria-hidden') !== 'true'
      );
      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) return;
    form.resetFields();
    setAuthError(false);
  }, [isOpen, form]);

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) onClose();
  };

  const handleValuesChange = () => {
    if (authError) setAuthError(false);
  };

  const handleFinish = (values) => {
    if (onSubmit) {
      onSubmit(values);
      return;
    }

    setAuthError(true);
    requestAnimationFrame(() => {
      getInputElement(emailInputRef)?.focus?.({ preventScroll: true });
    });
  };

  if (!isOpen) return null;

  const describedBy = authError ? ERROR_ID : undefined;

  return ReactDOM.createPortal(
    <div
      className="login-modal-overlay"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        className="login-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="login-modal__header">
          <h2 id="login-modal-title" className="login-modal__title">
            Вход
          </h2>
          <button
            type="button"
            className="login-modal__close"
            onClick={onClose}
          >
            <span>Закрыть</span>
            <CloseOutlined aria-hidden="true" />
          </button>
        </header>

        <Form
          form={form}
          name="login"
          layout="vertical"
          requiredMark={false}
          colon={false}
          className="login-modal__form"
          onFinish={handleFinish}
          onValuesChange={handleValuesChange}
        >
          <Form.Item
            name="email"
            label="Email"
            htmlFor="login-modal-email"
            rules={[
              { required: true, message: 'Введите Email' },
              { type: 'email', message: 'Введите Email в формате name@example.com' },
            ]}
          >
            <Input
              ref={emailInputRef}
              id="login-modal-email"
              type="email"
              name="email"
              size="large"
              autoComplete="username"
              placeholder="Введите Email"
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
            htmlFor="login-modal-password"
            rules={[{ required: true, message: 'Введите пароль' }]}
          >
            <Input.Password
              id="login-modal-password"
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

          <p id={ERROR_ID} className="login-modal__error" role="status">
            {authError ? ERROR_MESSAGE : ''}
          </p>

          <Button
            className="login-modal__submit"
            type="primary"
            htmlType="submit"
            size="large"
            block
          >
            Войти
          </Button>
        </Form>
      </div>
    </div>,
    document.body
  );
};

export default LoginModal;
