/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { DBWCareLogo } from "@plane/propel/icons";
// helpers
import { EAuthModes } from "@/types/auth";

type TAuthHeader = {
  authMode: EAuthModes;
};

type TAuthHeaderContent = {
  header: string;
  subHeader: string;
};

type TAuthHeaderDetails = {
  [mode in EAuthModes]: TAuthHeaderContent;
};

const Titles: TAuthHeaderDetails = {
  [EAuthModes.SIGN_IN]: {
    header: "Schau rein, kommentier, bleib dabei.",
    subHeader: "Meld dich an und behalte den Überblick.",
  },
  [EAuthModes.SIGN_UP]: {
    header: "Schau rein, kommentier, bleib dabei.",
    subHeader: "Meld dich an und behalte den Überblick.",
  },
};

export function AuthHeader(props: TAuthHeader) {
  const { authMode } = props;

  const getHeaderSubHeader = (mode: EAuthModes | null): TAuthHeaderContent => {
    if (mode) {
      return Titles[mode];
    }

    return {
      header: "Schau rein, kommentier, bleib dabei.",
      subHeader: "Meld dich an und behalte den Überblick.",
    };
  };

  const { header, subHeader } = getHeaderSubHeader(authMode);

  return (
    <div className="flex flex-col items-center gap-4">
      <DBWCareLogo className="mb-2" />
      <div className="flex flex-col gap-1 text-center">
        <span className="text-20 leading-7 font-semibold text-primary">{header}</span>
        <span className="text-20 leading-7 font-semibold text-placeholder">{subHeader}</span>
      </div>
    </div>
  );
}
