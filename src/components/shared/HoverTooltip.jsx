import React, { cloneElement, isValidElement, useState } from 'react';
import { Tooltip } from 'antd';

/**
 * Tooltip only on hover; closes immediately on click/tap so it does not stick.
 */
function HoverTooltip({ children, ...tooltipProps }) {
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  const child = isValidElement(children) ? (
    cloneElement(children, {
      onClick: (event) => {
        close();
        children.props.onClick?.(event);
      },
    })
  ) : (
    <span onClick={close}>{children}</span>
  );

  const hasTitle =
    tooltipProps.title !== undefined &&
    tooltipProps.title !== null &&
    tooltipProps.title !== false &&
    tooltipProps.title !== '';

  return (
    <Tooltip
      {...tooltipProps}
      trigger="hover"
      open={hasTitle ? open : false}
      onOpenChange={(nextOpen) => {
        if (nextOpen && !hasTitle) {
          setOpen(false);
          return;
        }
        setOpen(nextOpen);
      }}
    >
      {child}
    </Tooltip>
  );
}

export default HoverTooltip;
