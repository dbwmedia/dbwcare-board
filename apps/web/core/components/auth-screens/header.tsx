/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { PlaneLockup } from "@plane/propel/icons";
import { PageHead } from "@/components/core/page-title";
import { EAuthModes } from "@/helpers/authentication.helper";

type AuthHeaderProps = {
  type: EAuthModes;
};

export const AuthHeader = observer(function AuthHeader({ type }: AuthHeaderProps) {
  const pageTitle = type === EAuthModes.SIGN_IN ? "Sign in" : "Sign up";

  return (
    <AuthHeaderBase
      pageTitle={pageTitle}
      additionalAction={
        <span className="text-13 text-tertiary">
          Von{" "}
          <a
            href="https://dbw-media.de"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-tertiary underline hover:text-secondary"
          >
            dbw media
          </a>
        </span>
      }
    />
  );
});

type TAuthHeaderBase = {
  pageTitle: string;
  additionalAction?: React.ReactNode;
};

export function AuthHeaderBase(props: TAuthHeaderBase) {
  const { pageTitle, additionalAction } = props;
  return (
    <>
      <PageHead title={pageTitle + " - DBWCARE BOARD"} />
      <div className="sticky top-0 flex w-full flex-shrink-0 items-center justify-between gap-6">
        <Link href="/">
          <PlaneLockup height={20} width={95} className="text-primary" />
        </Link>
        {additionalAction}
      </div>
    </>
  );
}
