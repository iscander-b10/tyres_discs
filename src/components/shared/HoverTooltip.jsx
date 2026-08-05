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

  return (
    <Tooltip
      {...tooltipProps}
      trigger="hover"
      open={open}
      onOpenChange={setOpen}
    >
      {child}
    </Tooltip>
  );
}

export default HoverTooltip;
