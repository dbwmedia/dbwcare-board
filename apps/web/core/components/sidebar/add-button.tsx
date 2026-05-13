/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Button } from "@plane/propel/button";

type Props = React.ComponentProps<"button"> & {
  label: React.ReactNode;
  onClick: () => void;
};

export function SidebarAddButton(props: Props) {
  const { label, onClick, disabled, ...rest } = props;
  return (
    <Button
      variant={"primary"}
      size={"xl"}
      className="dbw-btn-gradient w-full justify-start"
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      {label}
    </Button>
  );
}
